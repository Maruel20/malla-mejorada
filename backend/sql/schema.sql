CREATE DATABASE IF NOT EXISTS malla_curricular CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE malla_curricular;

DROP TABLE IF EXISTS student_approved_courses;
DROP TABLE IF EXISTS prerequisites;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS students;

CREATE TABLE students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  document_number VARCHAR(30) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE courses (
  code VARCHAR(10) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  semester INT NOT NULL,
  credits INT NOT NULL,
  area VARCHAR(120) NOT NULL
);

CREATE TABLE prerequisites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_code VARCHAR(10) NOT NULL,
  prerequisite_code VARCHAR(10) NOT NULL,
  CONSTRAINT fk_prereq_course FOREIGN KEY (course_code) REFERENCES courses(code) ON DELETE CASCADE,
  CONSTRAINT fk_prereq_required FOREIGN KEY (prerequisite_code) REFERENCES courses(code) ON DELETE CASCADE,
  CONSTRAINT uq_prereq UNIQUE (course_code, prerequisite_code)
);

CREATE TABLE student_approved_courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  course_code VARCHAR(10) NOT NULL,
  approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_student_approved_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_student_approved_course FOREIGN KEY (course_code) REFERENCES courses(code) ON DELETE CASCADE,
  CONSTRAINT uq_student_course UNIQUE (student_id, course_code)
);
