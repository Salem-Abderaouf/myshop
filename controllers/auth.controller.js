import {
  checkAndInsertUser,
  checkEmailPassword
} from "../models/auth.model.js";
import {
  signupSchema,
  signinSchema
} from '../routes/dataValidation/validator.js';
import {v4 as uuidv4} from 'uuid';
import bcrypt from 'bcryptjs';
import Prisma from '@prisma/client';
import jwt from 'jsonwebtoken';
import {transporter} from '../mailing/mails.js'

const prisma = new Prisma.PrismaClient();

// sign up process
const postSignup = async (req, res, next) => {
  // data validation
  const {error, value} = signupSchema.validate(req.body, {abortEarly:false});
  if (!error) {
    const user = req.body
    await checkAndInsertUser(user, res)
    .then(
      (user) => {
        res.status(200).send(
          {
            success: true,
            message: "signed up successfully",
            user: user
          }
        );
      }
    )
    .catch(
      (error) => {
        res.status(400).send(
          {
            success: false,
            message: "an error occured",
            error: error
          }
        );
      }
    );
  }
  else
  {
    let messages = [];
    error.details.map(
      (e) => {
        messages.push(e.message);
      }
    );
    res.status(400).send(
      {
        success: false,
        message: "user errors, check the data you have inserted",
        errors: messages
      }
    );
  };
};

// login process

const postSignin = async (req, res, next) => {
  const {email, password} = req.body;
  const {error, value} = signinSchema.validate(req.body, {abortEarly:false});
  if(!error){
    await checkEmailPassword(email, password)
    .then(
      (user) => {
        res.status(200).json(
          {
            success: true,
            message: "sign in success",
            userId: user.id,
            token: jwt.sign(
              {
                "userInfo": {
                  "userId": user.id,
                  "permissions": user.permissions
                }
              },
              process.env.jwtSecret,
              { expiresIn: "24h" }
            )
          }
        );
      }  
    )
    .catch(
      (error) => {
        console.log(error);
        res.status(500).json(
          {
            success: false,
            message: 'problem occured',
            error: error
          }
        );
      }
    );
  }
  else
  {
    let messages = [];
    error.details.map(
      (e) => {
        messages.push(e.message);
      }
    );
    res.status(400).send(
      {
        success: false,
        message: "user errors, check the data you have inserted",
        errors: messages
      }
    );
  }
};

// send verification email

const sendVerificationEmail = (userInDb, res) => { 
  // user info
  const {id,email} = userInDb;
  // url to be used in email
  const currentUrl = "http://localhost:4000/";
  // creating unique string
  const uniqueString = uuidv4() + id;
  // mail options
  const mailOptions = {
    from : process.env.AUTH_EMAIL,
    to : email,
    subject : "verify your email",
    html : `<p>verify your email address to complete the signup and login into your account.</p><p>this link <b>expires in 6 hours</b>.</p><p> Press <a href=${currentUrl + "auth/verify/" + id + "/"+ uniqueString}> here</a> to proceed.</p>`,
  };
  // hash the unique string
  const saltrounds = 10;
  bcrypt.hash(uniqueString, saltrounds)
  .then( 
    async (hashedUniqueString) => {     //hashing process successful
      await prisma.Userverifications.create(
        {
          data: {
            userId: id.toString(),
            uniqueString: hashedUniqueString,
            createdAt: new Date(),
            expiresAt: new Date(new Date().getTime()+(24*60*60*1000))
          }
        }
      )
      .then(
        async () => {
          // send an email to user's email address for verification
          await transporter.sendMail(mailOptions)
          .then(
            async (mailSent) => {
              if(mailSent){
                res.status(200).json(
                  {
                    success: true,
                    message: "pending! verification email is sent",
                    id: id,
                    uniqueString: uniqueString,
                  }
                );
              }
              else
              {
                res.status(500).json(
                  {
                    success: false,
                    message: "system error, sending verification email has failed",
                    error: error
                  }
                );
              }
            }
          )
          .catch(
            (error) => {
              console.log(error);
              res.status(400).json(
                {
                    success: false,
                    message: "failed to send mail",
                    error: error
                }
              );
            }
          )
        }
      )
      .catch(
        (error) => {
          console.log(error);
          res.status(500).json(
            {
                success: false,
                message: "error on writing in db",
                error: error
            }
          );
        }
      );
    }
  )
  .catch(
    (error) => {
      console.log(error);
      res.status(500).json(
        {
            success: false,
            message: "system error, hash failure",
            error: error 
        }
      );
    }
  );
};

// sign out 
const signout = (req, res, next) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
};

export {
  postSignup,
  signout,
  postSignin,
  sendVerificationEmail
};
