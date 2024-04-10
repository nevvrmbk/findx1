import express, { type Request, type Response, type NextFunction } from "express";
import { configure } from "nunjucks";
import session from "express-session";
import flash from "connect-flash";
import passport from "passport";
import { Strategy } from "passport-local";
import { PrismaClient, User } from "@prisma/client";
import { body, matchedData, validationResult } from "express-validator";
import multer from "multer";
const Store = require("connect-sqlite3")(session);
import { join } from "path";
import { nextTick } from "process";
import 'dotenv/config';

const app = express();
const port = process.env.PORT || 3000;
const SECRET = process.env.SECRET || "a super secret secret";
const viewsDir = join(__dirname, "views");
const prisma = new PrismaClient();
const uploads = multer({
    dest: "uploads",
    storage: multer.diskStorage({
        filename(req, file, callback) {
            callback(null, file.originalname);
        },
    }),
    limits: { files: 20, fieldNameSize: 50000000, },
    fileFilter(req, file, callback) {
        const mimetypes = /audio|video|image/;
        if (mimetypes.test(file.mimetype)) {
            callback(null, true);
        }
    },
});

app.use(express.json());
app.use(express.urlencoded({ extended: false, }));
app.use(session({ secret: SECRET, resave: true, saveUninitialized: false, store: new Store, }));

passport.use("local", new Strategy({ usernameField: "email" }, (email, password, done) => {
    nextTick(async () => {
        const user = await prisma.user.findUnique({ where: { email: email, } });
        if (!user) return done(null, false, { message: "Account with email does not exist." });
        if (user.password == password) {
            return done(null, user);
        } else {
            return done(null, false, { message: "Incorrect Password", });
        }
    });
}));
passport.serializeUser<number>((user, done) => done(null, (user as User).id));
passport.deserializeUser<User>(async (id, done) => {
    const user = await prisma.user.findUnique({ where: { id: id as unknown as number } });
    done(null, user);
});

app.use(passport.initialize());
app.use(passport.session());
const protectedAuthenticatedRoute = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) {
        return next();
    }
    req.flash("message", "Please login to view that resource.");
    return res.redirect(302, "/login");
}

app.use(flash());
app.use((req: Request, res: Response, next: NextFunction) => {
    // res.locals.messages = req.flash();
    res.locals.authenticated = req.isAuthenticated();
    if (req.user) res.locals.name = (req.user as User).firstName;
    res.locals.errors = validationResult(req).array({ onlyFirstError: false, });
    next();
});

configure(viewsDir, { autoescape: true, express: app });

app.get("/", [protectedAuthenticatedRoute,], (req: Request, res: Response) => {
    return res.render("index.njk");
});
app.post("/", [protectedAuthenticatedRoute, body("files").exists().notEmpty().withMessage("Please select a file."), uploads.array("files"),], (req: Request, res: Response) => {
    const files = req.files;
    console.log(files);
    return res.render("index.njk", { files });
});

app.get("/register", (req: Request, res: Response) => res.render("register.njk"));
app.post("/register", [body(["firstName", "lastName", "username", "phoneNumber"]).exists().withMessage("Empty Fields!"), body("email").exists().withMessage("Email Field is Required").isEmail().withMessage("Invalid Input.").escape(), body("password").exists().withMessage("Password Field is Required.")], async (req: Request, res: Response) => {
    const vr = validationResult(req);
    if (!vr.isEmpty()) {
        const errors = vr.array({ onlyFirstError: true, });
        return res.render("register.njk", { errors });
    }
    const data = matchedData(req, { includeOptionals: false, locations: ["body",], onlyValidData: true, }) as { firstName: string, lastName: string, phoneNumber: string, username: string, email: string, password: string, };
    console.log(data);
    const user = await prisma.user.create({ data: { ...data } });
    if (user) {
        req.flash("Account creation successful.");
        return res.redirect("/login");
    }
    return res.render("register.njk");
});

app.get("/login", (req: Request, res: Response) => res.render("login.njk"));
app.post("/login", [body("email").exists().withMessage("Email Field is Required").isEmail().withMessage("Invalid Input.").escape(), body("password").exists().withMessage("Password Field is Required."), passport.authenticate("local", { failureFlash: true, failureMessage: "Invalid email or password.", failureRedirect: "back", failWithError: true, successFlash: true, successMessage: "Successfully logged in.", successRedirect: "/", })], (req: Request<{}, {}, { email: string, password: string, }, {}>, res: Response) => {
    return res.render("login.njk");
});

app.get("/logout", [protectedAuthenticatedRoute,], (req: Request, res: Response) => {
    req.logout({ keepSessionInfo: true, }, (err) => console.log(err));
    req.flash("message", "You are logged out.");
    return res.redirect("/login");
});

app.listen(port, () => console.log(`Server started on http://127.0.0.1:${port}`));
