const express = require("express");
const cors    = require("cors");
const helmet  = require("helmet");
const morgan  = require("morgan");
require("dotenv").config();

const sessionRoutes = require("./routes/session.routes");
const captchaRoutes = require("./routes/captcha.routes");

const app = express();

app.use(express.json());
app.use(cors({
  origin: "*"   // allow all origins in production for now
}));
app.use(helmet());
app.use(morgan("dev"));

app.use("/api/session", sessionRoutes);
app.use("/api/captcha", captchaRoutes);

module.exports = app;