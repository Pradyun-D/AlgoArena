import requests
import os
import environ
from pathlib import Path
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

# Load environment variable if running standalone
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
env_file = BASE_DIR / '.env'
if env_file.exists():
    environ.Env.read_env(env_file)

def get_judge_api_url():
    try:
        api_url = getattr(settings, "JUDGE_API_URL", "")
    except ImproperlyConfigured:
        api_url = ""

    api_url = api_url or os.environ.get("JUDGE_API_URL")
    if not api_url:
        raise ImproperlyConfigured("Set JUDGE_API_URL to your Judge0 submissions endpoint.")
    return api_url

def run_test(test_name, source_code, language_id, stdin=""):
    print(f"\n[{test_name}]")
    print("Sending to VM...")
    
    payload = {
        "source_code": source_code,
        "language_id": language_id,
        "stdin": stdin
    }
    params = {"base64_encoded": "false", "wait": "true"}
    
    try:
        response = requests.post(get_judge_api_url(), params=params, json=payload, timeout=30)
        response.raise_for_status()
        result = response.json()
        return result
            
    except Exception as e:
        print(f"Failed to connect: {e}")
        return None

if __name__ == "__main__":
    # ==========================================
    # TEST 1: The "Standard Input" Test
    # Tests if the VM can feed text into an app
    # ==========================================
    python_sort_code = """
    n = int(input())
    arr = []
    for _ in range(n):
        arr.append(int(input()))
    arr.sort()
    print(f"I sorted your numbers: {arr}")
    """
    run_test(
        test_name="Test 1: Standard Input (Python)",
        source_code=python_sort_code,
        language_id=71, 
        stdin="5\n99\n12\n45\n7\n22" # 5 numbers to sort
    )

    # ==========================================
    # TEST 2: The "Break It" Test
    # Tests if the VM safely kills infinite loops
    # ==========================================
    python_infinite_code = """
    print("I am going to loop forever!")
    while True:
        pass
    """
    run_test(
        test_name="Test 2: Time Limit Exceeded (Python)",
        source_code=python_infinite_code,
        language_id=71
    )

    # ==========================================
    # TEST 3: The "Polyglot" Test
    # Tests if the heavy C++ compiler works
    # ==========================================
    cpp_code = """
    #include <iostream>
    using namespace std;
    int main() {
        cout << "Success! The C++ compiler is fully operational!" << endl;
        return 0;
    }
    """
    run_test(
        test_name="Test 3: C++ Compilation",
        source_code=cpp_code,
        language_id=54 # 54 is the ID for C++ (GCC)
    )
