import requests

API_URL = "http://192.168.1.3:2358/submissions" #needs to be changed in each run 

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
        response = requests.post(API_URL, params=params, json=payload)
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