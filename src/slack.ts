import { App, ExpressReceiver } from "@slack/bolt";
import { APIGatewayProxyEvent, Context } from "aws-lambda";
import * as awsServerlessExpress from "aws-serverless-express";
import * as env from "env-var";
import fetch from "node-fetch";

const expressReceiver = new ExpressReceiver({
  signingSecret: env.get("SLACK_SIGNING_SECRET").required().asString(),
  processBeforeResponse: true,
});

const app = new App({
  token: env.get("SLACK_BOT_TOKEN").required().asString(),
  receiver: expressReceiver,
});

const slackHookUrl = env.get("SLACK_HOOK_URL").required().asString();

app.command("/mhfa", async ({ logger, command, ack, respond }) => {
  ack();
  try {
    const slackHookResponse = await fetch(slackHookUrl, {
      method: "post",
      headers: {
        "Content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: JSON.stringify({
        text: `We have received a new message from ${command.user_name}`,
      }),
    });
    if (slackHookResponse.ok) {
      logger.info(
        "Slack Hook request succeeded with JSON response",
        await slackHookResponse.json
      );
      await respond({
        text:
          "Thanks for reaching out. Your message has been highlighted to the Mental Health First Aiders and one of them will be in touch as soon as possible. " +
            "If you need more immediate help then you may find useful info in https://www.mentalhealthatwork.org.uk/urgent-help/",
        response_type: "ephemeral",
        as_user: true,
      });
    } else {
      throw Error(
        `Slack Hook request failed: ${slackHookResponse.status} ${slackHookResponse.statusText}`
      );
    }
  } catch (e) {
    logger.error(e);
    await respond({
      text: `We're sorry, something went wrong, please try again.`,
      response_type: "ephemeral",
      as_user: true,
    });
  }
});

const server = awsServerlessExpress.createServer(expressReceiver.app);
const handler = (event: APIGatewayProxyEvent, context: Context) =>
  awsServerlessExpress.proxy(server, event, context);
exports.handler = handler;
