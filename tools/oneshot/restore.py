import json

with open('/Users/home/.gemini/antigravity/brain/24bc10e0-7b79-4b9b-bd52-9be1fe25653b/.system_generated/logs/transcript_full.jsonl', 'r') as f:
    for line in f:
        data = json.loads(line)
        if data.get('step_index') == 41:
            code = data['tool_calls'][0]['args']['CodeContent']
            with open('web/content/assets/physarum.js', 'w') as out:
                out.write(code)
            print("RESTORED!")
            break
