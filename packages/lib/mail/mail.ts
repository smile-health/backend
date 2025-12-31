import { emailTransport } from "./config";

export class Mailer {
  public async sendMail(user: string, subject: string, html: string) {
    const mailOptions = {
      from: process.env.MAIL_SENDER,
      to: user,
      subject,
      html,
    };

    return new Promise((resolve, reject) => {
      // send mail with defined transport object
      emailTransport.sendMail(mailOptions, function (error, response) {
        if (error) {
          console.error(error);
          reject(error);
        } else {
          console.log("Message sent: " + JSON.stringify(response));
          resolve(response);
        }
        emailTransport.close(); // shut down the connection pool, no more messages
      });
    });
  }
}
