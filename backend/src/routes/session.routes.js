const express = require("express");
const router = express.Router();

const { analyzeSession } = require("../controllers/session.controller");
const { validateSession } = require("../middleware/validate.middleware");

router.post("/analyze", validateSession, analyzeSession);

module.exports = router;
