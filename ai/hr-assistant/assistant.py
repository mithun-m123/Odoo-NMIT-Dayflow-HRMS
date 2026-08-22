from google import genai
from config import GEMINI_API_KEY


class HRAssistant:
    def __init__(self):
        self.client = genai.Client(api_key=GEMINI_API_KEY)

    def ask(self, question):
        prompt = f"""
You are Dayflow AI, an HR assistant inside a Human Resource Management System.

Your responsibilities include helping employees with:
- Attendance
- Leave
- Payroll
- Employee information
- HR policies
- General HR-related questions

Rules:
1. Give clear and professional answers.
2. Do not invent employee-specific information.
3. If you don't have access to required HR data, clearly say so.
4. Do not make decisions about salary, leave approval, termination, or disciplinary action.
5. Keep responses concise and useful.

Employee question:
{question}
"""

        response = self.client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )

        return response.text


if __name__ == "__main__":
    assistant = HRAssistant()

    print("Dayflow AI HR Assistant")
    print("Type 'exit' to quit.\n")

    while True:
        question = input("You: ")

        if question.lower() == "exit":
            break

        try:
            answer = assistant.ask(question)
            print(f"\nDayflow AI: {answer}\n")
        except Exception as error:
            print(f"\nError: {error}\n")