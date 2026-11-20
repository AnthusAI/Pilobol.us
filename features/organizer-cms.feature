Feature: Full organizer CMS rollout
  Scenario: Preserve the publication and authoring workflows
    Given Pilobolus uses its existing authenticated main backend
    When the organizer CMS frontend is released
    Then taxonomy, concepts, knowledge search, curation and administration remain available
    And private editing actions retain their existing permissions
    And the S3 public reader remains unchanged
    And no synthetic gateway or classifier is activated

  Scenario: A frontend update preserves authentication
    Given the existing Cognito domain and callbacks are working
    When the existing hosting pipeline builds the new frontend
    Then it generates main backend outputs without deploying backend changes
    And the retired legacy application is excluded
