import logging
from db import get_connection
from .run import run_test

def judge_submission(submission_id):
    connection = None
    cursor = None
    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        # fetch submission (join languages so we have the name for ID resolution)
        cursor.execute("""
            SELECT s.*, l.name AS language_name, cp.max_score
            FROM Submissions s
            LEFT JOIN languages l ON l.language_id = s.language_id
            LEFT JOIN contest_problems cp ON cp.contest_id = s.contest_id AND cp.problem_id = s.problem_id
            WHERE s.submission_id = %s
        """, (submission_id,))
        submission = cursor.fetchone()

        if not submission:
            logging.error(f"Submission {submission_id} not found.")
            return

        print(f"\n=== Starting Evaluation for Submission {submission_id} ===")

        # Update status to Processing
        cursor.execute("UPDATE Submissions SET status = 'Processing' WHERE submission_id = %s", (submission_id,))
        connection.commit()

        # fetch test cases
        cursor.execute("SELECT * FROM TestCases WHERE problem_id = %s", (submission["problem_id"],))
        test_cases = cursor.fetchall()
        
        accepted = True
        verdict = "Accepted"
        max_execution_time_ms = 0
        max_memory_used_kb = 0

        for test_case in test_cases:
            try:
                # run code
                result = run_test(
                    test_name=f"TestCase {test_case['testcase_id']}",
                    source_code=submission["source_code"],
                    language_id=submission["language_id"],
                    stdin=test_case.get("input", "")
                )

                # VM returned None — connection failure
                if result is None:
                    raise RuntimeError("No response from judge VM (connection failed)")

                status_id = result.get('status', {}).get('id')
                
                if status_id == 3: # Successful execution
                    stdout = result.get('stdout') or ""
                    expected_output = test_case.get("expected_output", "")
                    
                    # compare output
                    if stdout.strip() == expected_output.strip():
                        judge_verdict = "Passed"
                    else:
                        judge_verdict = "Failed" 
                elif status_id == 5:
                    judge_verdict = "Time Limit Exceeded"
                elif status_id == 6:
                    judge_verdict = "Compilation Error"
                else: 
                    judge_verdict = "Runtime Error"

                execution_time_ms = int(float(result.get('time') or 0) * 1000)
                memory_used_kb = int(result.get('memory') or 0)

                max_execution_time_ms = max(max_execution_time_ms, execution_time_ms)
                max_memory_used_kb = max(max_memory_used_kb, memory_used_kb)

                if judge_verdict != "Passed":
                    accepted = False
                    verdict = "Wrong Answer" if judge_verdict == "Failed" else judge_verdict
                
                print(f"-> Test Case {test_case['testcase_id']}: {judge_verdict} (Time: {execution_time_ms}ms, Memory: {memory_used_kb}KB)")
                
                # store result for each testcase
                cursor.execute("""
                    INSERT INTO SubmissionResults(submission_id, test_case_id, verdict, execution_time_ms, memory_used_kb)
                    VALUES(%s, %s, %s, %s, %s)
                """, (submission_id, test_case["testcase_id"], judge_verdict, execution_time_ms, memory_used_kb))
            
                if not accepted:
                    break
                    
            except Exception as tc_error:
                logging.error(f"Error processing test case {test_case.get('testcase_id')} for submission {submission_id}: {tc_error}")
                accepted = False
                verdict = "Runtime Error"
                
                # Attempt to save the error result for the testcase
                cursor.execute("""
                    INSERT INTO SubmissionResults(submission_id, test_case_id, verdict, execution_time_ms, memory_used_kb)
                    VALUES(%s, %s, %s, %s, %s)
                """, (submission_id, test_case.get("testcase_id"), "Runtime Error", 0, 0))
                break

        # update submission status and verdict
        print(f"=== Final Verdict: {verdict} ===\n")
        cursor.execute("""
            UPDATE Submissions
            SET status = 'Completed', verdict = %s, max_execution_time_ms = %s, max_memory_used_kb = %s
            WHERE submission_id = %s
        """, (verdict, max_execution_time_ms, max_memory_used_kb, submission_id))
        
        # update contest_problem_scores table if part of a contest
        if submission.get("contest_id") and submission.get("user_id"):
            is_accepted = (verdict == "Accepted")
            max_score = submission.get("max_score")
            score_to_add = max_score if (max_score and is_accepted) else 0

            cursor.execute("""
                INSERT INTO contest_problem_scores 
                    (contest_id, user_id, problem_id, score, time_penalty_ms, is_accepted)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE 
                    score = GREATEST(score, %s),
                    time_penalty_ms = IF(%s AND NOT is_accepted, %s, time_penalty_ms),
                    is_accepted = is_accepted OR %s,
                    updated_at = CURRENT_TIMESTAMP
            """, (
                submission["contest_id"], 
                submission["user_id"], 
                submission["problem_id"], 
                score_to_add, 
                max_execution_time_ms, 
                is_accepted,
                # For ON DUPLICATE KEY UPDATE:
                score_to_add,
                is_accepted,
                max_execution_time_ms,
                is_accepted
            ))
        # print(submission)

        connection.commit()

    except Exception as e:
        logging.error(f"System error judging submission {submission_id}: {e}")
        
        if connection and cursor:
            try:
                connection.rollback()
                cursor.execute("""
                    UPDATE Submissions
                    SET status = 'System_Error'
                    WHERE submission_id = %s
                """, (submission_id,))
                connection.commit()
            except Exception as rollback_err:
                logging.error(f"Failed to update submission to System_Error: {rollback_err}")

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()
