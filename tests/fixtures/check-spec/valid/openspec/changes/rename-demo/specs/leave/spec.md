## RENAMED Requirements

- FROM: `### Requirement: Demo submit`
- TO: `### Requirement: Demo submit v2`

## MODIFIED Requirements
### Requirement: Demo submit v2
The system SHALL accept a demo request.

#### Scenario: AC-DEMO-01 Accept a request
- **WHEN** a request is submitted
- **THEN** it is stored

#### Scenario: AC-DEMO-02: Reject an empty request
- **WHEN** an empty request is submitted
- **THEN** it is rejected

#### Scenario: AC-DEMO-03: New scenario inside a modified requirement
- **WHEN** x
- **THEN** y
