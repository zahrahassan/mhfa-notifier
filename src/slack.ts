import {
  App,
  ExpressReceiver,
  Logger,
  RespondFn,
  SlackCommandMiddlewareArgs,
  SlashCommand,
} from "@slack/bolt";
import { APIGatewayProxyEvent, Context } from "aws-lambda";
import * as awsServerlessExpress from "aws-serverless-express";
import * as env from "env-var";
import fetch from "node-fetch";

const expressReceiver = new ExpressReceiver({
  signingSecret: env.get("SLACK_SIGNING_SECRET").required().asString(),
  clientId: env.get("SLACK_CLIENT_ID").required().asString(),
  clientSecret: env.get("SLACK_CLIENT_SECRET").required().asString(),
  stateSecret: env.get("STATE_SECRET").required().asString(),
  scopes: ["commands"],
  processBeforeResponse: true
});

const app = new App({
  receiver: expressReceiver,
});

export type Destination = "user" | "channel";

export interface Response {
  message: string;
  destination: Destination;
}

const handleResponse = async (
  response: Promise<Response>,
  respond: RespondFn,
  logger: Logger,
  text: string,
  username: string
): Promise<void> => {
  try {
    const responseType = "ephemeral";
    const resp = await response;
    fetch( "https://hooks.slack.com/services/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", {
      method: 'post',
      headers: {
        "Content-type": "application/x-www-form-urlencoded; charset=UTF-8"
      },
      body: JSON.stringify({text:`We have received a new message from ${username}`})
    })
        .then(function (data) {
          console.log('Request succeeded with JSON response', data);
        })
        .catch(function (error) {
          console.log('Request failed', error);
        });
    //resp.message
    await respond({
      text: "Thanks for reaching out. Your message has been highlighted to the Mental Health First Aiders and one of them will be in touch as soon as possible.",
      response_type: responseType,
      as_user: true,
    });
  } catch (e) {
    logger.error(e);
    await respond({
      text: `❌ Unhandled error 😢`,
      response_type: "ephemeral",
      as_user: true,
    });
  }
};

const handle = (getResponse: (command: SlashCommand) => Promise<Response>) => {
  return async ({
    command,
    logger,
    ack,
    respond,
  }: SlackCommandMiddlewareArgs & {
    logger: Logger;
  }) => {
    await ack();
    const response = getResponse(command);
    await handleResponse(response, respond, logger, command.text, command.user_name);
  };
};

app.command(
    "/mhfa",
    handle((command) => {
      return Promise.resolve({
        message: "Someone will get in touch with you",
        destination: "user",
      } as Response);
    })
);

const server = awsServerlessExpress.createServer(expressReceiver.app);
const handler = (event: APIGatewayProxyEvent, context: Context) =>
  awsServerlessExpress.proxy(server, event, context);
exports.handler = handler;

