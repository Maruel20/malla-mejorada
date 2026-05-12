import { Router } from 'express';
import {
  listStudents,
  getStudentCurriculum,
  enrollSemester,
  updateGrade,
  deleteCourse
} from '../controllers/studentController.js';

const router = Router();

router.get('/',                          listStudents);
router.get('/:id/curriculum',            getStudentCurriculum);
router.post('/:id/enroll-semester',      enrollSemester);
router.put('/:id/courses/:code',         updateGrade);
router.delete('/:id/courses/:code',      deleteCourse);

export default router;
