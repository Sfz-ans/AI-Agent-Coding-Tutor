from flask import Flask, request, jsonify, render_template
import requests
import markdown
from datetime import datetime
import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv() 
app = Flask(__name__, template_folder='templates')

client = OpenAI(
    api_key=os.environ.get("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1",
)

FIREBASE_CONFIG = {
    "apiKey": "AIzaSyBj90NjnxdXzKE3KtDOh5Q-NrJ5VOX-YRc",
    "authDomain": "ai-coding-tutor-8aa2d.firebaseapp.com",
    "projectId": "ai-coding-tutor-8aa2d",
    "storageBucket": "ai-coding-tutor-8aa2d.firebasestorage.app",
    "messagingSenderId": "80480466801",
    "appId": "1:80480466801:web:7bb7fa34617afec16ca8d0",
    "measurementId": "G-50LVJDQNER"
}

FIRESTORE_BASE_URL = (
    f"https://firestore.googleapis.com/v1/projects/"
    f"{FIREBASE_CONFIG['projectId']}/databases/(default)/documents"
)

def save_message(user_id, role, content):
    url = f"{FIRESTORE_BASE_URL}/conversations/{user_id}/messages"
    data = {
        "fields": {
            "role": {"stringValue": role},
            "content": {"stringValue": content},
            "timestamp": {"timestampValue": datetime.utcnow().isoformat() + "Z"}
        }
    }
    requests.post(url, json=data)


def get_last_messages(user_id, limit=10):
    url = f"{FIRESTORE_BASE_URL}/conversations/{user_id}/messages?pageSize={limit}&orderBy=timestamp desc"
    r = requests.get(url)
    history = []

    if r.status_code == 200:
        documents = r.json().get("documents", [])
        for doc in reversed(documents):
            fields = doc["fields"]
            history.append({
                "role": fields["role"]["stringValue"],
                "content": fields["content"]["stringValue"]
            })

    return history

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/ask', methods=['POST'])
def ask_tutor():
    data = request.get_json()
    question = data.get('question', '').strip()
    user_id = data.get('user_id', 'default_user')

    if not question:
        return jsonify({'answer': "Please ask a valid question."})

    try:
        history = get_last_messages(user_id)
        history.append({"role": "user", "content": question})

        response = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {"role": "system", "content": "You are a helpful coding tutor who 1.give concise explanations unless asked to describe the topic 2.asks simple questions back as per prompts and previous interactions 3.who remembers previous interactions."}
            ] + history,
            temperature=0.6,
            max_tokens=1500
        )

        answer_text = response.choices[0].message.content
        answer_html = markdown.markdown(answer_text, extensions=['fenced_code', 'tables'])

        save_message(user_id, "user", question)
        save_message(user_id, "assistant", answer_text)

    except Exception as e:
        answer_html = f"AI Error: {e}"

    return jsonify({'answer': answer_html})


if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)

