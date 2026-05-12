USE malla_curricular;

INSERT INTO courses (code, name, semester, credits, area) VALUES
-- Semestre 1
('453007', 'APRENDIZAJE AUTÓNOMO',                                    1,  1, 'ÁREA FORMACIÓN COMPLEMENTARIA'),
('453058', 'UNIVERSIDAD Y CONTEXTO PARA LA CONVIVENCIA PACÍFICA',     1,  0, 'ÁREA FORMACIÓN COMPLEMENTARIA'),
('453001', 'CÁLCULO I',                                               1,  3, 'ÁREA BÁSICA'),
('453004', 'INFORMÁTICA',                                             1,  2, 'ÁREA BÁSICA'),
('453005', 'INGLÉS I',                                                1,  2, 'ÁREA FORMACIÓN COMPLEMENTARIA'),
('453003', 'INTRODUCCIÓN A LA INGENIERÍA AMBIENTAL',                  1,  2, 'ÁREA BÁSICA'),
('453002', 'QUÍMICA GENERAL',                                         1,  3, 'ÁREA BÁSICA'),
-- Semestre 2
('453012', 'ÁLGEBRA LINEAL Y GEOMETRÍA',                              2,  3, 'ÁREA BÁSICA'),
('453011', 'BIOLOGÍA GENERAL',                                        2,  3, 'ÁREA BÁSICA'),
('453008', 'CÁLCULO II',                                              2,  3, 'ÁREA BÁSICA'),
('453009', 'FÍSICA I',                                                2,  3, 'ÁREA BÁSICA'),
('453010', 'QUÍMICA ORGÁNICA',                                        2,  3, 'ÁREA BÁSICA'),
('453013', 'INGLÉS II',                                               2,  2, 'ÁREA FORMACIÓN COMPLEMENTARIA'),
-- Semestre 3
('453016', 'CÁLCULO III',                                             3,  3, 'ÁREA BÁSICA'),
('453014', 'ECUACIONES DIFERENCIALES',                                3,  3, 'ÁREA BÁSICA'),
('453015', 'FÍSICA II',                                               3,  3, 'ÁREA BÁSICA'),
('453017', 'QUÍMICA ANALÍTICA',                                       3,  3, 'ÁREA BÁSICA'),
('453019', 'INGLÉS III',                                              3,  2, 'ÁREA FORMACIÓN COMPLEMENTARIA'),
('453018', 'ECOLOGÍA',                                                3,  3, 'CIENCIAS BÁSICA DE INGENIERÍA'),
-- Semestre 4
('453021', 'ESTADÍSTICA',                                             4,  2, 'ÁREA BÁSICA'),
('453022', 'MÉTODOS NUMÉRICOS',                                       4,  3, 'ÁREA FORMACIÓN COMPLEMENTARIA'),
('453020', 'BIOQUÍMICA',                                              4,  3, 'CIENCIAS BÁSICA DE INGENIERÍA'),
('453025', 'INGLÉS IV',                                               4,  2, 'CIENCIAS BÁSICA DE INGENIERÍA'),
('453024', 'ESTÁTICA',                                                4,  3, 'CIENCIAS BÁSICA DE INGENIERÍA'),
('453023', 'TERMODINÁMICA',                                           4,  3, 'CIENCIAS BÁSICA DE INGENIERÍA'),
-- Semestre 5
('453026', 'MICROBIOLOGÍA',                                           5,  3, 'ÁREA BÁSICA'),
('453031', 'METODOLOGÍA DE LA INVESTIGACIÓN',                         5,  2, 'ÁREA FORMACIÓN COMPLEMENTARIA'),
('453030', 'FÍSICA AMBIENTAL',                                        5,  3, 'CIENCIAS BÁSICA DE INGENIERÍA'),
('453029', 'MECÁNICA DE FLUIDOS',                                     5,  3, 'CIENCIAS BÁSICA DE INGENIERÍA'),
('453028', 'QUÍMICA AMBIENTAL',                                       5,  3, 'CIENCIAS BÁSICA DE INGENIERÍA'),
('453027', 'TOPOGRAFÍA',                                              5,  3, 'CIENCIAS BÁSICA DE INGENIERÍA'),
-- Semestre 6
('453032', 'FISICOQUÍMICA',                                           6,  2, 'ÁREA BÁSICA'),
('453033', 'GEOCIENCIAS I',                                           6,  3, 'CIENCIAS BÁSICA DE INGENIERÍA'),
('453034', 'HIDRÁULICA',                                              6,  3, 'CIENCIAS BÁSICA DE INGENIERÍA'),
('453035', 'TRANSFERENCIA DE MASA Y ENERGÍA',                         6,  3, 'INGENIERÍA APLICADA'),
('453036', 'ELECTIVA DE CARRERA I',                                   6,  4, 'INGENIERÍA APLICADA'),
('453109', 'BIOTECNOLOGÍA AMBIENTAL',                                 6,  4, 'INGENIERÍA APLICADA'),
('453057', 'PROCESOS UNITARIOS',                                      6,  4, 'INGENIERÍA APLICADA'),
-- Semestre 7
('453037', 'GEOCIENCIAS II',                                          7,  3, 'CIENCIAS BÁSICA DE INGENIERÍA'),
('453038', 'GEOMÁTICA I',                                             7,  3, 'CIENCIAS BÁSICA DE INGENIERÍA'),
('453039', 'CONTAMINACIÓN Y CONTROL DEL AGUA',                        7,  3, 'INGENIERÍA APLICADA'),
('453040', 'SEMINARIO DE INVESTIGACIÓN',                              7,  2, 'INGENIERÍA APLICADA'),
('453041', 'ELECTIVA DE CARRERA II',                                  7,  4, 'INGENIERÍA APLICADA'),
('453042', 'ELECTIVA LIBRE I',                                        7,  2, 'ÁREA FORMACIÓN COMPLEMENTARIA'),
-- Semestre 8
('453047', 'GEOMÁTICA II',                                            8,  3, 'CIENCIAS BÁSICA DE INGENIERÍA'),
('453043', 'HIDROLOGÍA',                                              8,  3, 'INGENIERÍA APLICADA'),
('453044', 'RESIDUOS SÓLIDOS',                                        8,  3, 'INGENIERÍA APLICADA'),
('453045', 'ELECTIVA DE PROFUNDIZACIÓN I',                            8,  4, 'INGENIERÍA APLICADA'),
('453046', 'TECNOLOGÍAS AMBIENTALES',                                 8,  3, 'INGENIERÍA APLICADA'),
-- Semestre 9
('453052', 'ECONOMÍA AMBIENTAL',                                      9,  2, 'ÁREA FORMACIÓN COMPLEMENTARIA'),
('453053', 'LEGISLACIÓN AMBIENTAL',                                   9,  3, 'ÁREA FORMACIÓN COMPLEMENTARIA'),
('453049', 'CONTAMINACIÓN Y CONTROL DE AIRE',                         9,  3, 'INGENIERÍA APLICADA'),
('453048', 'CONTAMINACIÓN Y CONTROL DEL SUELO',                       9,  3, 'INGENIERÍA APLICADA'),
('453050', 'ELECTIVA DE PROFUNDIZACIÓN II',                           9,  4, 'INGENIERÍA APLICADA'),
('453051', 'ELECTIVA LIBRE II',                                       9,  2, 'INGENIERÍA APLICADA'),
-- Semestre 10
('453056', 'ELECTIVA DE PROFUNDIZACIÓN III',                         10,  4, 'INGENIERÍA APLICADA'),
('453055', 'EVALUACIÓN DE IMPACTO AMBIENTAL',                        10,  3, 'INGENIERÍA APLICADA'),
('453054', 'TRABAJO DE GRADO',                                       10, 10, 'INGENIERÍA APLICADA');

INSERT INTO prerequisites (course_code, prerequisite_code) VALUES
-- Semestre 2
('453012', '453001'),
('453008', '453001'),
('453010', '453002'),
('453013', '453005'),
-- Semestre 3
('453016', '453008'),
('453014', '453008'),
('453015', '453009'),
('453017', '453010'),
('453019', '453013'),
('453018', '453011'),
-- Semestre 4
('453022', '453014'),
('453020', '453017'),
('453025', '453019'),
('453024', '453015'),
('453023', '453015'),
-- Semestre 5
('453026', '453011'),
('453030', '453015'),
('453029', '453024'),
('453028', '453020'),
-- Semestre 6
('453032', '453017'),
('453033', '453002'),
('453034', '453029'),
('453057', '453026'),
('453057', '453017'),
-- Semestre 7
('453037', '453033'),
('453038', '453027'),
('453039', '453035'),
('453040', '453031'),
('453041', '453036'),
-- Semestre 8
('453047', '453038'),
('453043', '453029'),
('453044', '453027'),
('453045', '453036'),
('453046', '453039'),
-- Semestre 9
('453049', '453037'),
('453048', '453033'),
('453048', '453017'),
('453050', '453045'),
-- Semestre 10
('453056', '453050'),
('453055', '453039'),
('453055', '453053'),
('453055', '453049'),
('453055', '453048'),
('453054', '453040');
