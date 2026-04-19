
from django.db.models import CASCADE
import mysql.connector
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()
BASE_DIR = Path(__file__).resolve().parent
ca_env = os.getenv('CA', 'certs/isrgrootx1.pem')
ca_path = Path(ca_env)
if not ca_path.is_absolute():
    ca_path = BASE_DIR / ca_path
ca_path = str(ca_path.resolve())
db_host = os.getenv('DB_HOST', 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com')
db_port = int(os.getenv('DB_PORT', '4000'))
db_name = os.getenv('DB_NAME', 'test')
db_username = os.getenv('DB_USER', '')
db_pass = os.getenv('DB_PASS', '')

config = {
    'host': db_host,
    'port': db_port,
    'user': db_username,
    'password': db_pass,
    'database': db_name,
    'ssl_ca': ca_path,  
    'ssl_verify_cert': True,
   
}

def get_connection():
    ca_file = Path(ca_path)
    if not ca_file.exists():
        raise FileNotFoundError(f"CA certificate not found at: {ca_file}")
    connection = mysql.connector.connect(**config, use_pure=True)
    cursor = connection.cursor()
    try:
        cursor.execute("SET time_zone = '+00:00'")
    finally:
        cursor.close()
    return connection

user_queries = [
    """
        CREATE TABLE IF NOT EXISTS roles(
            role_id INT AUTO_INCREMENT PRIMARY KEY,
            role_name VARCHAR(255) NOT NULL UNIQUE,
            description TEXT
        );
        CREATE TABLE IF NOT EXISTS user(
            user_id INT AUTO_INCREMENT PRIMARY KEY,
            uuid CHAR(36) UNIQUE,
            username VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE,
            password_hash VARCHAR(255),
            role_id INT,
            status ENUM('active', 'banned') DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            deleted_at TIMESTAMP NULL, 
            FOREIGN KEY(role_id) REFERENCES roles(role_id)
        );
        CREATE TABLE IF NOT EXISTS profile(
            profile_id INT AUTO_INCREMENT PRIMARY KEY,
            uuid CHAR(36) UNIQUE,
            user_id INT,
            full_name VARCHAR(500),
            bio VARCHAR(500),
            avatar_url VARCHAR(500),
            college VARCHAR(500),
            total_problems_solved INT DEFAULT 0, 
            FOREIGN KEY(user_id) REFERENCES user(user_id)
        );
    """
]

# add_uuid = [
#     """
#         ALTER TABLE user ADD COLUMN uuid CHAR(36);
#         ALTER TABLE user ADD UNIQUE(uuid);    
#         ALTER TABLE profile ADD COLUMN uuid CHAR(36);
#         ALTER TABLE profile ADD UNIQUE(uuid);
#     """
# ]

problem_queries = [
    """
        CREATE TABLE IF NOT EXISTS problems(
            problem_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
            title VARCHAR(255) NOT NULL,
            slug VARCHAR(255) NOT NULL,
            description TEXT,
            difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'easy',
            time_limit_ms INT,
            memory_limit_kb INT,
            visibility ENUM('public', 'private', 'contest_only') DEFAULT 'public',
            created_by INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY(created_by) REFERENCES user(user_id)
        );
        ALTER TABLE problems ADD UNIQUE(problem_id);

        CREATE TABLE IF NOT EXISTS tags(
            tag_id INT AUTO_INCREMENT PRIMARY KEY, 
            name VARCHAR(255) UNIQUE
        );
        CREATE TABLE IF NOT EXISTS problem_tags(
            problem_id CHAR(36),
            tag_id INT,
            PRIMARY KEY(problem_id, tag_id),
            FOREIGN KEY(problem_id) REFERENCES problems(problem_id),
            FOREIGN KEY(tag_id) REFERENCES tags(tag_id)
        );
        CREATE TABLE IF NOT EXISTS editorials(
            editorial_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
            created_by INT NULL,
            problem_id CHAR(36),
            content TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY(problem_id) REFERENCES problems(problem_id)
        );
        ALTER TABLE editorials ADD UNIQUE(editorial_id);
        
    """
]

contest_queries = [
    """
        CREATE TABLE IF NOT EXISTS contests(
            contest_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
            title VARCHAR(255) NOT NULL,
            description TEXT,
            start_time TIMESTAMP,
            end_time TIMESTAMP,
            visibility ENUM('public', 'private') DEFAULT 'public',
            created_by INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY(created_by) REFERENCES user(user_id)
        );
        ALTER TABLE contests ADD UNIQUE(contest_id);
        CREATE TABLE IF NOT EXISTS contest_problems(
            contest_id CHAR(36),
            problem_id CHAR(36),
            max_score INT,
            PRIMARY KEY(contest_id, problem_id),
            FOREIGN KEY(contest_id) REFERENCES contests(contest_id),
            FOREIGN KEY(problem_id) REFERENCES problems(problem_id)
        );
        CREATE TABLE IF NOT EXISTS contest_participants(
            contest_id CHAR(36),
            user_id INT,
            problems_solved INT DEFAULT 0,
            current_score INT DEFAULT 0,
            time_penalty_ms INT DEFAULT 0,
            PRIMARY KEY(contest_id, user_id),
            FOREIGN KEY(contest_id) REFERENCES contests(contest_id),
            FOREIGN KEY(user_id) REFERENCES user(user_id)
        );
    """
]

exec_engine_queries = [
    """
        CREATE TABLE IF NOT EXISTS languages(
            language_id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) UNIQUE
        );
        CREATE TABLE IF NOT EXISTS testcases(
            testcase_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
            problem_id CHAR(36),
            input TEXT,
            expected_output TEXT,
            is_sample BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY(problem_id) REFERENCES problems(problem_id)
        );
        ALTER TABLE testcases ADD UNIQUE(testcase_id);

        CREATE TABLE IF NOT EXISTS Submissions(
            submission_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
            user_id INT,
            problem_id CHAR(36),
            contest_id CHAR(36),
            language_id INT,
            source_code TEXT,
            verdict ENUM('Pending', 'Accepted', 'Wrong Answer', 'Time Limit Exceeded', 'Runtime Error', 'Compilation Error', 'Memory Limit Exceeded'),
            status ENUM('In_Queue', 'Processing', 'Completed', 'System_Error'),
            max_execution_time_ms INT,
            max_memory_used_kb INT,
            submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES user(user_id),
            FOREIGN KEY(problem_id) REFERENCES problems(problem_id),
            FOREIGN KEY(contest_id) REFERENCES contests(contest_id),
            FOREIGN KEY(language_id) REFERENCES languages(language_id)
        );
        ALTER TABLE Submissions ADD UNIQUE(submission_id);

        CREATE TABLE IF NOT EXISTS SubmissionResults(
            result_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
            submission_id CHAR(36),
            test_case_id CHAR(36),
            verdict ENUM('Passed', 'Failed', 'Time Limit Exceeded', 'Runtime Error', 'Compilation Error', 'Memory Limit Exceeded', 'Skipped'),
            execution_time_ms INT,
            memory_used_kb INT,
            FOREIGN KEY (submission_id) REFERENCES Submissions(submission_id),
            FOREIGN KEY (test_case_id) REFERENCES testcases(testcase_id)
        );
        ALTER TABLE SubmissionResults ADD UNIQUE(result_id);
    """

]

insert_language_queries = [
    """
        INSERT IGNORE INTO languages (language_id, name) VALUES
        (43, 'Plain Text'),
        (44, 'Executable'),
        (45, 'Assembly (NASM 2.14.02)'),
        (46, 'Bash (5.0.0)'),
        (47, 'Basic (FBC 1.07.1)'),
        (48, 'C (GCC 7.4.0)'),
        (49, 'C (GCC 8.3.0)'),
        (50, 'C (GCC 9.2.0)'),
        (51, 'C# (Mono 6.6.0.161)'),
        (52, 'C++ (GCC 7.4.0)'),
        (53, 'C++ (GCC 8.3.0)'),
        (54, 'C++ (GCC 9.2.0)'),
        (55, 'Common Lisp (SBCL 2.0.0)'),
        (56, 'D (DMD 2.089.1)'),
        (57, 'Elixir (1.9.4)'),
        (58, 'Erlang (OTP 22.2)'),
        (59, 'Fortran (GFortran 9.2.0)'),
        (60, 'Go (1.13.5)'),
        (61, 'Haskell (GHC 8.8.1)'),
        (62, 'Java (OpenJDK 13.0.1)'),
        (63, 'JavaScript (Node.js 12.14.0)'),
        (64, 'Lua (5.3.5)'),
        (65, 'OCaml (4.09.0)'),
        (66, 'Octave (5.1.0)'),
        (67, 'Pascal (FPC 3.0.4)'),
        (68, 'PHP (7.4.1)'),
        (69, 'Prolog (GNU Prolog 1.4.5)'),
        (70, 'Python (2.7.17)'),
        (71, 'Python (3.8.1)'),
        (72, 'Ruby (2.7.0)'),
        (73, 'Rust (1.40.0)'),
        (74, 'TypeScript (3.7.4)'),
        (75, 'C (Clang 7.0.1)'),
        (76, 'C++ (Clang 7.0.1)'),
        (77, 'COBOL (GnuCOBOL 2.2)'),
        (78, 'Kotlin (1.3.70)'),
        (79, 'Objective-C (Clang 7.0.1)'),
        (80, 'R (4.0.0)'),
        (81, 'Scala (2.13.2)'),
        (82, 'SQL (SQLite 3.27.2)'),
        (83, 'Swift (5.2.3)'),
        (84, 'Visual Basic.Net (vbnc 0.0.0.5943)'),
        (85, 'Perl (5.28.1)'),
        (86, 'Clojure (1.10.1)'),
        (87, 'F# (.NET Core SDK 3.1.202)'),
        (88, 'Groovy (3.0.3)'),
        (89, 'Multi-file program');
    """
]

draft_query = [
    """
    CREATE TABLE IF NOT EXISTS drafts (
        contest_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        start_time TIMESTAMP NULL,
        end_time TIMESTAMP NULL,
        visibility ENUM('public', 'private') DEFAULT 'public',
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY(created_by) REFERENCES user(user_id)
    );
    """
]

score_query = [
    """
    CREATE TABLE IF NOT EXISTS contest_problem_scores (
    contest_id CHAR(36) NOT NULL,
    user_id INT NOT NULL,
    problem_id CHAR(36) NOT NULL,
    score INT NOT NULL DEFAULT 0,
    time_penalty_ms INT NOT NULL DEFAULT 0,
    is_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- The primary key ensures a user only has ONE score record per problem, per contest
    PRIMARY KEY (contest_id, user_id, problem_id),
    
    -- Foreign Key Constraints to maintain data integrity
    FOREIGN KEY (contest_id) REFERENCES contests(contest_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE,
    FOREIGN KEY (problem_id) REFERENCES problems(problem_id) ON DELETE CASCADE
    );
    """
]

adding_cascade = [
    """
    Drop old FK
    ALTER TABLE contest_participants 
    DROP FOREIGN KEY fk_1;

    Add new FK with CASCADE
    ALTER TABLE contest_participants 
    ADD CONSTRAINT fk_contest_participants_contest
    FOREIGN KEY (contest_id) 
    REFERENCES contests(contest_id) 
    ON DELETE CASCADE;

    ALTER TABLE Submissions 
    DROP FOREIGN KEY fk_3;
    
    ALTER TABLE Submissions 
    ADD CONSTRAINT fk_submissions_contest
    FOREIGN KEY (contest_id) 
    REFERENCES contests(contest_id) 
    ON DELETE CASCADE;    
    """
]

if __name__ == "__main__":
    connection=get_connection()
    cursor=connection.cursor()

    for query in score_query:
        cursor.execute(query)

    connection.commit()
    cursor.close()
    connection.close()
