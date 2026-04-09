from rest_framework import serializers
import mysql.connector
import uuid
import importlib.util
import sys
import os

module_name = "local_db"

base_dir = os.path.dirname(os.path.abspath(__file__))
file_path = os.path.join(base_dir, "..", "local_db.py")

# Normalize path
file_path = os.path.normpath(file_path)

spec = importlib.util.spec_from_file_location(module_name, file_path)
local_db = importlib.util.module_from_spec(spec)
sys.modules[module_name] = local_db
spec.loader.exec_module(local_db)

conn = local_db.get_db_connection()
cursor = conn.cursor(dictionary=True)

class ContestSerializer(serializers.Serializer):
    
    # read only fields
    contest_id = serializers.UUIDField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    created_by = serializers.IntegerField(read_only=True) 

    # writable fields
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(style={'base_template': 'textarea.html'})
    start_time = serializers.DateTimeField()
    end_time = serializers.DateTimeField()
    visibility = serializers.ChoiceField(choices=['Public', 'Private'])

 
    def validate(self, data):
        if len(data["title"])==0:
            raise serializers.ValidationError("Title must not be empty")      
        if data["start_time"]>=data["end_time"]:
            raise serializers.ValidationError("End time must occur after start time.")
        return data

 
    def create(self, validated_data):
       
        # 1. Generate UUID for the new contest
        import uuid
        new_id = str(uuid.uuid4())

        # 2. Connect to DB and Insert


        try:
            sql = """
                INSERT INTO contests 
                (contest_id, title, description, start_time, end_time, visibility, created_by) 
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            values = (
                new_id,
                validated_data['title'],
                validated_data['description'],
                validated_data['start_time'].strftime('%Y-%m-%d %H:%M:%S'),
                validated_data['end_time'].strftime('%Y-%m-%d %H:%M:%S'),
                validated_data['visibility'],
                validated_data.get('created_by') 
            )
            
            cursor.execute(sql, values)
            conn.commit()
            
            # 3. Add the generated ID back to the data so the frontend can see it
            validated_data['contest_id'] = new_id
        finally:
            cursor.close()
            conn.close()

        return validated_data

class EditorialSerializer(serializers.Serializer):

    # read only fields
    editorial_id = serializers.UUIDField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    created_by = serializers.IntegerField(read_only=True) 

    # writable fields
    problem_id = serializers.UUIDField()
    content = serializers.CharField(style={'base_template': 'textarea.html'})

    def validate(self, data):
        if not data.get("content") or len(data["content"].strip()) == 0:
            raise serializers.ValidationError({"content": "Content must not be empty."})
        return data

    def create(self, validated_data):

        new_id = str(uuid.uuid4())
    

        try:
            sql = """
                INSERT INTO editorials 
                (editorial_id, problem_id, content, created_by) 
                VALUES (%s, %s, %s, %s)
            """
            values = (
                new_id,
                str(validated_data['problem_id']),
                validated_data['content'],
                validated_data.get('created_by')
            )
            
            cursor.execute(sql, values)
            conn.commit()
            
            # Append generated values to return them gracefully
            validated_data['editorial_id'] = new_id
            
        finally:
            cursor.close()
            conn.close()

        return validated_data