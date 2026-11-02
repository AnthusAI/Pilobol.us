Feature: AWS identifiers stay outside Git
  This repository holds no AWS account id, Amplify app id or CloudFront distribution id. The deploy workflow reads
  them from GitHub repository variables, and Amplify builds read them from branch variables.

  Scenario: The deploy workflow takes its ids from repository variables
    Given the repository variables AWS_ACCOUNT_ID and AMPLIFY_APP_ID are set
    When a green push to main starts the deploy job
    Then the workflow passes app-id from AMPLIFY_APP_ID and aws-account-id from AWS_ACCOUNT_ID
    And it assumes the role named pilobol-us-github-deploy in that account

  Scenario: Only the owning Amplify app builds the backend
    Given the main branch of the owning app has the variable PAPYRUS_AMPLIFY_APP_ID
    When a build runs in an app whose id differs from that variable
    Then the amplify.yml guard fails the build before anything deploys
    And a build in the owning app passes the guard and deploys the backend

  Scenario: A build that forgets the variable fails closed
    Given a build runs inside Amplify and PAPYRUS_AMPLIFY_APP_ID is not set
    Then the amplify.yml guard fails and names the variable to set
    And the postinstall step fails instead of lifting the owning-app guard

  Scenario: A local install deploys nothing
    Given npm install runs outside an Amplify build
    Then the postinstall step reports that it is not running inside Amplify and skips

  Scenario: Sign-in keeps every return URL in use
    Given the owning app id is available to the build as PAPYRUS_AMPLIFY_APP_ID
    When the backend is configured
    Then the sign-in return URLs include localhost, newsroom.pilobol.us and staging.pilobol.us
    And they include every entry of PAPYRUS_OAUTH_REDIRECT_URLS and the origin in PAPYRUS_SITE_ORIGIN
    And they include the main and staging Amplify hosts of the owning app, each with and without /newsroom
    And no Amplify host or app id is written in papyrus.config.ts
