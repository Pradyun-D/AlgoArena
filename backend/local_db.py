import mysql.connector
from ..db import config

def get_db_connection():
    return mysql.connector.connect(
        host=config["host"], 
        user=config["user"], 
        password=config["password"], 
        database=config["database"]
    )