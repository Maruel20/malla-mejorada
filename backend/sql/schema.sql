CREATE DATABASE IF NOT EXISTS malla_curricular CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE malla_curricular;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS student_courses;
DROP TABLE IF EXISTS prerequisites;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS students;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE students (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  nombre          VARCHAR(80)  NOT NULL,
  apellido        VARCHAR(80)  NOT NULL,
  cedula          VARCHAR(30)  NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE courses (
  codigo   VARCHAR(10)  PRIMARY KEY,
  nombre   VARCHAR(160) NOT NULL,
  semestre INT          NOT NULL,
  creditos INT          NOT NULL,
  area     VARCHAR(120) NOT NULL
);

CREATE TABLE prerequisites (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  codigo_materia  VARCHAR(10) NOT NULL,
  codigo_prereq   VARCHAR(10) NOT NULL,
  FOREIGN KEY (codigo_materia) REFERENCES courses(codigo) ON DELETE CASCADE,
  FOREIGN KEY (codigo_prereq)  REFERENCES courses(codigo) ON DELETE CASCADE,
  UNIQUE KEY uq_prereq (codigo_materia, codigo_prereq)
);

-- grade NULL = matriculada sin nota aún
CREATE TABLE student_courses (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  student_id  INT         NOT NULL,
  codigo      VARCHAR(10) NOT NULL,
  nota        DECIMAL(3,1) DEFAULT NULL,
  creado_en   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (codigo)     REFERENCES courses(codigo) ON DELETE CASCADE,
  UNIQUE KEY uq_student_course (student_id, codigo)
);
