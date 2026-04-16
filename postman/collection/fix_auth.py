#!/usr/bin/env python3
import json

# Read the current collection
with open('Loan_Lifecycle_API.postman_collection.json', 'r') as f:
    collection = json.load(f)

# Endpoints that need authentication
auth_endpoints = ['/auth/logout', '/onboarding/kyc', '/onboarding/status', '/auth/me']

def add_auth_to_items(items):
    """Recursively add auth to specific endpoints"""
    for item in items:
        if 'item' in item:
            # This is a folder, process its items
            add_auth_to_items(item['item'])
        elif 'request' in item and 'url' in item['request']:
            # This is a request, check if it needs auth
            url = item['request']['url']
            if isinstance(url, str):
                for endpoint in auth_endpoints:
                    if endpoint in url:
                        # Add Authorization header
                        if 'header' not in item['request']:
                            item['request']['header'] = []
                        
                        # Check if Authorization header already exists
                        auth_exists = any(
                            h.get('key') == 'Authorization' 
                            for h in item['request']['header']
                        )
                        
                        if not auth_exists:
                            item['request']['header'].append({
                                'key': 'Authorization',
                                'value': 'Bearer {{access_token}}',
                                'type': 'text'
                            })
                        break

# Process all items in the collection
if 'item' in collection:
    add_auth_to_items(collection['item'])

# Write the updated collection
with open('Loan_Lifecycle_API.postman_collection.json', 'w') as f:
    json.dump(collection, f, indent=2)

print("Authentication added to specific endpoints successfully")
