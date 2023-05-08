import { Stack, StackProps } from 'aws-cdk-lib';
import { AuthorizationType, EndpointType, LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { Effect, Policy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import { join } from 'path';

export class Aws4AxiosTestStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Very basic api gateway with a single endpoint protected by IAM Authorization
    const api = new RestApi(this, 'testingApi', {
      restApiName: 'AWS4 Axios Test Api',
      endpointConfiguration: {
        types: [
          EndpointType.REGIONAL,
        ],
      },
    });

    const apiLambdaFunction = new NodejsFunction(this, 'apiLambda', {
      entry: join(__dirname, '../src/api-lambda/index.ts'),
      runtime: Runtime.NODEJS_16_X,
    });

    const endpoint = api.root.addResource('test');
    endpoint.addMethod(
      'GET',
      new LambdaIntegration(apiLambdaFunction),
      {
        authorizationType: AuthorizationType.IAM,
      },
    );

    // Single lambda function with correct role to execute the api call with
    // IAM authentication based on the role
    const customRole = new Role(this, 'role', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });

    new NodejsFunction(this, 'testingLambda', {
      entry: join(__dirname, '../src/testing-lambda/index.ts'),
      runtime: Runtime.NODEJS_16_X,
      environment: {
        API_URL: api.url,
      },
      role: customRole,
    });

    customRole.attachInlinePolicy(
      new Policy(this, 'apiPolicy', {
        statements: [
          new PolicyStatement({
            actions: ['execute-api:Invoke'],
            effect: Effect.ALLOW,
            resources: [
              `arn:aws:execute-api:${Stack.of(this).region}:${Stack.of(this).account}:${api.restApiId}/*/*/*`,
            ],
          }),
        ],
      }),
    );

  }
}
