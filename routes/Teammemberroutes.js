import express from "express";
import { getTeamMembers, addTeamMember, removeTeamMember } from "../controllers/teamMemberController.js"


const router = express.Router();

router.get("/", getTeamMembers);
router.post("/", addTeamMember);
router.delete("/:id", removeTeamMember);

export default router;
