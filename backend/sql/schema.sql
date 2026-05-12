CREATE DATABASE IF NOT EXISTS malla_curricular CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE malla_curricular;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS student_courses;
DROP TABLE IF EXISTS prerequisites;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS students;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE students (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  first_name    VARCHAR(80)  NOT NULL,
  last_name     VARCHAR(80)  NOT NULL,
  document_number VARCHAR(30) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('student','professor','admin') DEFAULT 'student',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE courses (
  code     VARCHAR(10)  PRIMARY KEY,
  name     VARCHAR(160) NOT NULL,
  semester INT          NOT NULL,
  credits  INT          NOT NULL,
  area     VARCHAR(120) NOT NULL
);

CREATE TABLE prerequisites (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  course_code       VARCHAR(10) NOT NULL,
  prerequisite_code VARCHAR(10) NOT NULL,
  CONSTRAINT fk_prereq_course    FOREIGN KEY (course_code)       REFERENCES courses(code) ON DELETE CASCADE,
  CONSTRAINT fk_prereq_required  FOREIGN KEY (prerequisite_code) REFERENCES courses(code) ON DELETE CASCADE,
  CONSTRAINT uq_prereq           UNIQUE (course_code, prerequisite_code)
);

-- grade NULL means enrolled but not graded yet
CREATE TABLE student_courses (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  student_id  INT         NOT NULL,
  course_code VARCHAR(10) NOT NULL,
  grade       DECIMAL(3,1) DEFAULT NULL,
  enrolled_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP   DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sc_student FOREIGN KEY (student_id)  REFERENCES students(id)     ON DELETE CASCADE,
  CONSTRAINT fk_sc_course  FOREIGN KEY (course_code) REFERENCES courses(code)    ON DELETE CASCADE,
  CONSTRAINT uq_sc         UNIQUE (student_id, course_code)
);
