from flask import Flask, jsonify, request, Response
from flask_cors import CORS
from openpyxl import load_workbook
from io import BytesIO
import json
import os
from werkzeug.utils import secure_filename
import requests
import math
from dateutil import parser as dateutil_parser

app = Flask(__name__)

# CORS configuration
# In production, set CORS_ORIGINS env var to your frontend domain(s), comma-separated.
# Example: CORS_ORIGINS=https://importer.yourcompany.com
_cors_origins = os.environ.get('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173')
ALLOWED_ORIGINS = [o.strip() for o in _cors_origins.split(',') if o.strip()]
CORS(app, resources={
    r"/*": {
        "origins": ALLOWED_ORIGINS,
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "OrcanosAPIKey", "X-Orcanos-Domain"],
        "supports_credentials": True
    }
})

ALLOWED_EXTENSIONS = {'xlsx'}
UPLOAD_FOLDER = 'uploads'

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max

MANDATORY_FIELDS = ['Object_Name', 'Description']

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def serialize_value(obj):
    """Safe JSON serialization for NaN, None, infinite values"""
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
    return str(obj)

def _response_is_json(response):
    content_type = response.headers.get('Content-Type', '')
    return 'application/json' in content_type.lower()

def parse_orcanos_json(response):
    """
    Parse Orcanos API response body only when Content-Type is application/json.
    Returns (data, error_message). error_message is None on success.
    """
    text = response.text or ''
    if not text.strip():
        return None, "Server returned empty response. Please check your domain URL."
    if not _response_is_json(response):
        return None, (
            "Server returned unexpected response. Please check your domain URL is correct. "
            f"Received: {text[:200]}"
        )
    try:
        return response.json(), None
    except (json.JSONDecodeError, requests.exceptions.JSONDecodeError) as e:
        return None, f"Invalid JSON response: {str(e)}"

@app.route('/api/verify-auth', methods=['POST'])
@app.route('/verify-auth', methods=['POST'])
def verify_auth():
    try:
        payload = request.get_json()
        if not payload:
            return jsonify({"valid": False, "error": "No data provided"}), 400

        domain = payload.get('domain', '')
        headers = payload.get('headers', {})

        if not domain:
            return jsonify({"valid": False, "error": "Domain is required"}), 400

        url = f"https://{domain}/api/v2/Json/QW_Login"
        response = requests.post(url, headers=headers, timeout=30)

        # Handle 401/403 status codes
        if response.status_code in (401, 403):
            return jsonify({"valid": False, "error": "Access denied. Please check your credentials."})

        # If response is not JSON (HTML page, bad domain, etc.)
        response_data, parse_error = parse_orcanos_json(response)
        if parse_error:
            return jsonify({"valid": False, "error": "Cannot reach Orcanos. Please check your domain is correct."})

        if response_data.get('IsSuccess'):
            projects = response_data.get('Data', {}).get('Projects', {}).get('Project', [])
            return jsonify({"valid": True, "projectsList": projects})

        # Check for SSO / auth failure messages
        message = response_data.get('Message', '')
        message_lower = message.lower() if message else ''
        if 'sso' in message_lower or 'try using sso' in message_lower \
                or 'authentication' in message_lower or 'login' in message_lower \
                or 'password' in message_lower or 'credential' in message_lower \
                or not message:
            return jsonify({"valid": False, "error": "Incorrect username or password. Please try again."})

        # Any other Orcanos-returned message — still keep it clean
        return jsonify({"valid": False, "error": "Incorrect username or password. Please try again."})

    except requests.exceptions.Timeout:
        return jsonify({"valid": False, "error": "Connection timed out. Please check your domain and try again."})
    except requests.exceptions.ConnectionError:
        return jsonify({"valid": False, "error": "Cannot reach Orcanos. Please check your domain is correct."})
    except requests.exceptions.RequestException:
        return jsonify({"valid": False, "error": "Cannot reach Orcanos. Please check your domain is correct."})
    except Exception:
        return jsonify({"valid": False, "error": "Something went wrong. Please try again."}), 500

@app.route('/ping', methods=['GET'])
def ping():
    try:
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"error": f"Error in ping: {str(e)}"}), 500

@app.route('/api/get-item-fields', methods=['POST'])
@app.route('/get-item-fields', methods=['POST'])
def get_item_fields():
    try:
        payload = request.get_json() or {}
        
        # Extract inputs
        item_type = payload.get('item_type', '')
        project_id = payload.get('project_id')
        major_version = payload.get('major_version')
        minor_version = payload.get('minor_version')
        
        # Extract credentials from payload or request headers
        domain = payload.get('domain')
        if not domain:
            domain = request.headers.get('X-Orcanos-Domain') or request.headers.get('Domain')
            
        # Headers extraction (OrcanosAPIKey, Authorization)
        headers = {}
        
        # Check request headers
        orcanos_api_key = request.headers.get('OrcanosAPIKey')
        authorization = request.headers.get('Authorization')
        
        if orcanos_api_key:
            headers['OrcanosAPIKey'] = orcanos_api_key
        if authorization:
            headers['Authorization'] = authorization
            
        # Check payload/body headers if sent from front-end state
        payload_headers = payload.get('headers') or {}
        if isinstance(payload_headers, dict):
            for k, v in payload_headers.items():
                if k.lower() == 'orcanosapikey' and not orcanos_api_key:
                    headers['OrcanosAPIKey'] = v
                elif k.lower() == 'authorization' and not authorization:
                    headers['Authorization'] = v
                    
        # Ensure Content-Type header is JSON
        headers['Content-Type'] = 'application/json'
        
        # Mock data — only in development (disabled when FLASK_ENV=production)
        use_mock = False
        if os.environ.get('FLASK_ENV', 'development') != 'production':
            if not domain or 'localhost' in domain or 'example.com' in domain or 'test' in domain:
                use_mock = True
            
        mock_fields = [
            {"name": "Project_ID", "is_mandatory": "1"},
            {"name": "Major_Version", "is_mandatory": "1"},
            {"name": "Minor_Version", "is_mandatory": "1"},
            {"name": "Object_Name", "is_mandatory": "1"},
            {"name": "Object_Type", "is_mandatory": "1"},
            {"name": "Description", "is_mandatory": "1"},
            {"name": "Customer_ID", "is_mandatory": "1"},
            {"name": "Site_ID", "is_mandatory": "1"},
            {"name": "Release_Version", "is_mandatory": "0"},
            {"name": "Build_Version", "is_mandatory": "0"},
            {"name": "Parent_ID", "is_mandatory": "0"},
            {"name": "Assigned_to", "is_mandatory": "0"},
            {"name": "Created_date", "is_mandatory": "0"},
            {"name": "Created_by", "is_mandatory": "0"},
            {"name": "Category", "is_mandatory": "0"},
            {"name": "Status", "is_mandatory": "0"},
            {"name": "Priority", "is_mandatory": "0"},
            {"name": "Start_Date", "is_mandatory": "0"},
            {"name": "Effort_Estimation", "is_mandatory": "0"},
            {"name": "Due_date", "is_mandatory": "0"},
            {"name": "CS1_Name", "is_mandatory": "0"},
            {"name": "CS1_value", "is_mandatory": "0"},
            {"name": "CS2_Name", "is_mandatory": "0"},
            {"name": "CS2_value", "is_mandatory": "0"},
            {"name": "CS3_Name", "is_mandatory": "0"},
            {"name": "CS3_value", "is_mandatory": "0"},
            {"name": "CS4_Name", "is_mandatory": "0"},
            {"name": "CS4_value", "is_mandatory": "0"},
            {"name": "CS5_Name", "is_mandatory": "0"},
            {"name": "CS5_value", "is_mandatory": "0"},
            {"name": "CS6_Name", "is_mandatory": "0"},
            {"name": "CS6_value", "is_mandatory": "0"},
            {"name": "CS7_Name", "is_mandatory": "0"},
            {"name": "CS7_value", "is_mandatory": "0"},
            {"name": "CS8_Name", "is_mandatory": "0"},
            {"name": "CS8_value", "is_mandatory": "0"},
            {"name": "CS9_Name", "is_mandatory": "0"},
            {"name": "CS9_value", "is_mandatory": "0"},
            {"name": "CS10_Name", "is_mandatory": "0"},
            {"name": "CS10_value", "is_mandatory": "0"},
            {"name": "Insert_to_Pool", "is_mandatory": "0"},
            {"name": "Migration_Reference", "is_mandatory": "0"},
            {"name": "External_ID", "is_mandatory": "0"},
            {"name": "SkipIfNameExists", "is_mandatory": "0"},
            {"name": "SpecialCustomFields", "is_mandatory": "0"}
        ]
        
        if use_mock:
            return jsonify({
                "IsSuccess": True,
                "HttpCode": 200,
                "Message": "Success",
                "Data": {
                    "field": mock_fields
                }
            })
            
        url = f"https://{domain}/api/v2/Json/QW_Get_Item_Add_Edit"
        orcanos_payload = {
            "Item_Type": item_type,
            "Project_id": project_id,
            "Major_Version": major_version,
            "Minor_Version": minor_version
        }
        
        try:
            response = requests.post(url, json=orcanos_payload, headers=headers, timeout=30)

            response_data, parse_error = parse_orcanos_json(response)

            # If parse succeeded and Orcanos reports success, return as-is
            if not parse_error:
                is_success = response_data.get('IsSuccess')
                http_code = response_data.get('HttpCode')
                has_fields = (
                    isinstance(response_data.get('Data'), dict) and
                    isinstance(response_data['Data'].get('field'), list) and
                    len(response_data['Data']['field']) > 0
                )

                if is_success and http_code == 200 and has_fields:
                    return jsonify(response_data)

            return jsonify({"error": "No fields returned. Please check your Project ID, Item Type, and Version."}), 400

        except requests.exceptions.Timeout:
            return jsonify({"error": "Connection timed out. Please check your domain."}), 400
        except requests.exceptions.ConnectionError:
            return jsonify({"error": "Could not connect to Orcanos. Please check your domain."}), 400
        except Exception as e:
            return jsonify({"error": f"Unexpected error: {str(e)}"}), 500
            
    except Exception as e:
        return jsonify({"error": f"Internal server error: {str(e)}", "Message": f"Internal server error: {str(e)}"}), 500

@app.route('/api/upload', methods=['POST'])
@app.route('/upload', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        if not allowed_file(file.filename):
            return jsonify({"error": "Please upload a valid Excel (.xlsx) file"}), 400
        
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Read Excel file into memory
        try:
            wb = load_workbook(filepath)
            ws = wb.active
            
            # Extract headers from first row
            headers = []
            for cell in ws[1]:
                headers.append(cell.value if cell.value is not None else '')
            
            # Extract all data rows
            all_rows = []
            preview_rows = []
            row_count = 0
            
            for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=False), start=2):
                # Check if row is completely empty
                row_values = [cell.value for cell in row]
                if all(v is None for v in row_values):
                    continue
                
                # Convert row to dict
                row_dict = {}
                for col_idx, cell in enumerate(row):
                    header = headers[col_idx] if col_idx < len(headers) else f"Column {col_idx + 1}"
                    row_dict[header] = cell.value
                
                all_rows.append(row_dict)
                if len(preview_rows) < 5:
                    preview_rows.append(row_dict)
                row_count += 1
            
            wb.close()
        except Exception as read_err:
            return jsonify({"error": f"Error reading Excel file: {str(read_err)}"}), 500
        finally:
            # Try to clean up temp file - don't fail if it can't be deleted
            try:
                if os.path.exists(filepath):
                    os.remove(filepath)
            except Exception as cleanup_err:
                # Log but don't fail - file will be cleaned up later
                print(f"Warning: Could not delete temp file {filepath}: {str(cleanup_err)}")
        
        return Response(
            json.dumps({
                "headers": headers,
                "preview": preview_rows,
                "data": all_rows,
                "totalRows": row_count
            }, default=serialize_value),
            mimetype='application/json',
            status=200
        )
    
    except Exception as e:
        return jsonify({"error": f"Error processing file: {str(e)}"}), 500

def validate_row(api_body, mandatory_fields=None):
    if mandatory_fields is None:
        mandatory_fields = MANDATORY_FIELDS
        
    reasons = []
    
    # 1. Check mandatory fields are present and not empty
    for field in mandatory_fields:
        val = api_body.get(field)
        if val is None or (isinstance(val, str) and val.strip() == ''):
            reasons.append(f"{field} is required")

   

    # 3. Object_Name max length
    obj_name = api_body.get('Object_Name')
    if obj_name is not None and isinstance(obj_name, str) and len(obj_name) > 255:
        reasons.append("Object_Name must not exceed 255 characters")

    # 4. Description must not be empty or just whitespace
    desc = api_body.get('Description')
    if desc is not None and isinstance(desc, str) and desc.strip() == '':
        # Only add if not already caught by mandatory check
        if "Description is required" not in reasons:
            reasons.append("Description must not be empty or just whitespace")

    # 5. Date fields validation
    for date_field in ['Due_date', 'Start_Date', 'Created_date']:
        val = api_body.get(date_field)
        if val is not None and val != '':
            val_str = str(val).strip()
            if val_str:
                try:
                    dateutil_parser.parse(val_str)
                except (ValueError, TypeError):
                    reasons.append(f"{date_field} must be a valid date format")
                    
    return reasons

@app.route('/api/validate-import', methods=['POST'])
@app.route('/validate-import', methods=['POST'])
def validate_import():
    try:
        payload = request.get_json()
        if not payload:
            return jsonify({"error": "No data provided"}), 400

        data = payload.get('data', [])
        mapping = payload.get('mapping', {})

        if not isinstance(data, list):
            return jsonify({"error": "Data must be a list"}), 400
        if not isinstance(mapping, dict):
            return jsonify({"error": "Mapping must be a dictionary"}), 400

        rows_result = []
        valid_count = 0
        invalid_count = 0

        mandatory_fields = payload.get('mandatory_fields', MANDATORY_FIELDS)

        # Build reverse mapping: orcanos_field -> excel_col
        for row_idx, row in enumerate(data, 1):
            api_body = {}

            project_config = payload.get('projectConfig', {})
            api_body['Project_ID'] = int(project_config.get('project_id', 0))
            api_body['Major_Version'] = int(project_config.get('major_version', 0))
            api_body['Minor_Version'] = int(project_config.get('minor_version', 0))
            api_body['Object_Type'] = project_config.get('object_type_label', project_config.get('item_type', ''))


            orcanos_fields = payload.get('orcanosFields', [])
            custom_fields = [
                f for f in orcanos_fields
                if isinstance(f.get('name'), str) and
                f['name'].startswith('CS') and
                f['name'][2:].isdigit()
            ]
            custom_field_index = {
                f['ws_add_col_name'].replace('_Name', '_value'): idx + 1
                for idx, f in enumerate(custom_fields)
            }

            for orcanos_field, parts in mapping.items():
                if not isinstance(parts, list) or len(parts) == 0:
                    continue

                resolved_value = ""
                for part in parts:
                    if not isinstance(part, dict):
                        continue
                    part_type = part.get('type')
                    part_val = part.get('value')
                    if part_type == 'column':
                        cell_val = row.get(part_val)
                        if cell_val is not None:
                            resolved_value += str(cell_val)
                    elif part_type == 'text':
                        if part_val is not None:
                            resolved_value += str(part_val)

                if orcanos_field in custom_field_index:
                    n = custom_field_index[orcanos_field]
                    field_title = next(
                        (f.get('title', '') for f in custom_fields if f['ws_add_col_name'].replace('_Name', '_value') == orcanos_field),
                        ''
                    )
                    api_body[f'CS{n}_Name'] = field_title
                    api_body[f'CS{n}_value'] = resolved_value
                else:
                    api_body[orcanos_field] = resolved_value

            if not api_body.get('Parent_ID'):
                api_body['Parent_ID'] = str(api_body['Project_ID'])

            reasons = validate_row(api_body, mandatory_fields)
            field_name_to_title = {
                f['ws_add_col_name'].replace('_Name', '_value'): f.get('title', f.get('name', ''))
                for f in orcanos_fields
            }
            reasons = [
                next((r.replace(fname, title) for fname, title in field_name_to_title.items() if fname in r), r)
                for r in reasons
            ]

            is_valid = len(reasons) == 0
            if is_valid:
                valid_count += 1
            else:
                invalid_count += 1

            rows_result.append({
                "row": row_idx,
                "objectName": serialize_value(api_body.get('Object_Name', '')) or '',
                "objectType": serialize_value(api_body.get('Object_Type', '')) or '',
                "valid": is_valid,
                "reasons": reasons
            })

        return Response(
            json.dumps({
                "totalRows": len(data),
                "validRows": valid_count,
                "invalidRows": invalid_count,
                "rows": rows_result
            }, default=serialize_value),
            mimetype='application/json',
            status=200
        )

    except Exception as e:
        return jsonify({"error": f"Error validating import: {str(e)}"}), 500

@app.route('/api/import', methods=['POST'])
@app.route('/import', methods=['POST'])
def import_data():
    try:
        payload = request.get_json()
        if not payload:
            return jsonify({"error": "No data provided"}), 400
            
        data = payload.get('data', [])
        mapping = payload.get('mapping', {})
        domain = payload.get('domain', '')
        headers = payload.get('headers', {})
        
        if not domain:
            return jsonify({"error": "Domain is required"}), 400
        
        if not isinstance(data, list):
            return jsonify({"error": "Data must be a list"}), 400
        
        if not isinstance(mapping, dict):
            return jsonify({"error": "Mapping must be a dictionary"}), 400
        
        results = []
        success_count = 0
        failed_count = 0
        skipped_count = 0
        mandatory_fields = payload.get('mandatory_fields', MANDATORY_FIELDS)
        
        def generate():
            nonlocal success_count, failed_count, skipped_count
            
            for row_idx, row in enumerate(data, 1):
                try:
                    # Apply mapping
                    api_body = {}

                    # Auto-inject from projectConfig
                    project_config = payload.get('projectConfig', {})
                    api_body['Project_ID'] = int(project_config.get('project_id', 0))
                    api_body['Major_Version'] = int(project_config.get('major_version', 0))
                    api_body['Minor_Version'] = int(project_config.get('minor_version', 0))
                    api_body['Object_Type'] = project_config.get('object_type_label', project_config.get('item_type', ''))
                    # Get orcanosFields for custom field title lookup
                    orcanos_fields = payload.get('orcanosFields', [])
                    custom_fields = [
                        f for f in orcanos_fields
                        if isinstance(f.get('name'), str) and
                        f['name'].startswith('CS') and
                        f['name'][2:].isdigit()
                    ]

                    # Build a lookup: field name -> CS slot index (1-based)
                    custom_field_index = {
                        f['ws_add_col_name'].replace('_Name', '_value'): idx + 1
                        for idx, f in enumerate(custom_fields)
                    }


                    for orcanos_field, parts in mapping.items():
                        if not isinstance(parts, list) or len(parts) == 0:
                            continue

                        resolved_value = ""
                        for part in parts:
                            if not isinstance(part, dict):
                                continue
                            part_type = part.get('type')
                            part_val = part.get('value')
                            if part_type == 'column':
                                cell_val = row.get(part_val)
                                if cell_val is not None:
                                    resolved_value += str(cell_val)
                            elif part_type == 'text':
                                if part_val is not None:
                                    resolved_value += str(part_val)

                        # Skip if value is empty/whitespace only
                        if not resolved_value.strip():
                            continue

                        # Check if this is a custom field
                        if orcanos_field in custom_field_index:
                            n = custom_field_index[orcanos_field]
                            field_title = next(
                                (f.get('title', '') for f in custom_fields if f['ws_add_col_name'].replace('_Name', '_value') == orcanos_field),
                                ''
                            )
                            api_body[f'CS{n}_Name'] = field_title
                            api_body[f'CS{n}_value'] = resolved_value
                        else:
                            api_body[orcanos_field] = resolved_value

                    # Parent_ID defaulting
                    if not api_body.get('Parent_ID'):
                        api_body['Parent_ID'] = str(api_body['Project_ID'])
                    
                    # Validate row
                    validation_errors = validate_row(api_body, mandatory_fields)
                    
                    result = {
                        'row': row_idx,
                        'objectName': serialize_value(api_body.get('Object_Name', '')),
                        'objectType': serialize_value(api_body.get('Object_Type', '')),
                        'status': 'pending',
                        'objectId': 0,
                        'error': ''
                    }
                    
                    if validation_errors:
                        result['status'] = 'skipped'
                        result['error'] = f"Validation failed: {', '.join(validation_errors)}"
                        skipped_count += 1
                    else:
                        # Call Orcanos API
                        try:

                            url = f"https://{domain}/api/v2/Json/QW_Add_Object"
                            response = requests.post(url, json=api_body, headers=headers, timeout=30)
                            
                            if response.status_code == 200:
                                response_data, parse_error = parse_orcanos_json(response)
                                if parse_error:
                                    result['status'] = 'failed'
                                    result['error'] = parse_error
                                    failed_count += 1
                                else:
                                    object_id = response_data.get('Data', 0)
                                    if isinstance(object_id, dict):
                                        error_info = object_id.get('ErrorInfo', '')
                                        result['status'] = 'failed'
                                        result['error'] = error_info if error_info else 'Object was not created.'
                                        failed_count += 1
                                    elif object_id and isinstance(object_id, (int, float)) and int(object_id) > 0:
                                        result['status'] = 'success'
                                        result['objectId'] = object_id
                                        success_count += 1
                                    else:
                                        result['status'] = 'failed'
                                        result['error'] = response_data.get('Message', 'Object was not created.')
                                        failed_count += 1
                            else:
                                result['status'] = 'failed'
                                result['error'] = f"API error: {response.status_code} - {response.text[:200]}"
                                failed_count += 1
                        except requests.exceptions.Timeout:
                            result['status'] = 'failed'
                            result['error'] = "Request timeout - API server not responding"
                            failed_count += 1
                        except requests.exceptions.RequestException as e:
                            result['status'] = 'failed'
                            result['error'] = f"Network error: {str(e)}"
                            failed_count += 1
                        except Exception as e:
                            result['status'] = 'failed'
                            result['error'] = str(e)
                            failed_count += 1
                    
                    results.append(result)
                
                except Exception as e:
                    result = {
                        'row': row_idx,
                        'objectName': '',
                        'objectType': '',
                        'status': 'failed',
                        'objectId': 0,
                        'error': f"Error processing row: {str(e)}"
                    }
                    results.append(result)
                    failed_count += 1
                
                # Stream progress
                yield json.dumps({
                    'type': 'progress',
                    'row': row_idx,
                    'total': len(data)
                }, default=serialize_value) + '\n'
            
            # Stream final results
            yield json.dumps({
                'type': 'done',
                'results': results,
                'summary': {
                    'total': len(data),
                    'success': success_count,
                    'failed': failed_count,
                    'skipped': skipped_count
                }
            }, default=serialize_value) + '\n'
        
        return Response(generate(), mimetype='application/x-ndjson')
    
    except Exception as e:
        return jsonify({"error": f"Error processing import: {str(e)}"}), 500
    
@app.route('/health')
def health():
    return {"status": "ok"}

if __name__ == '__main__':
    debug_mode = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=debug_mode, host='0.0.0.0', port=port)