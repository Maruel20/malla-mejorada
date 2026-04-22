import { Router } from 'express';
import {
  approveCourse,
  createStudent,
  deleteApprovedCourse,
  getStudentCurriculum,
  listStudents
} from '../controllers/studentController.js';

const router = Router();

router.get('/', listStudents);
router.post('/', createStudent);
router.get('/:id/curriculum', getStudentCurriculum);
router.post('/:id/approved-courses', approveCourse);
router.delete('/:id/approved-courses/:courseCode', deleteApprovedCourse);

export default router;
