import json
def FN_NAME(request):
    body = {
        "message": "LunchBadger Python Serverless!",
        "input": request.json
    }

    response = {
        "statusCode": 200,
        "body": json.dumps(body)
    }

    return response