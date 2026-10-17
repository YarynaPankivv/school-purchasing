# leave Specification

## Purpose
Fixture: canonical spec with two well-formed scenarios for the check-spec tests.

## Requirements
### Requirement: Demo submit
The system SHALL accept a demo request.

#### Scenario: AC-DEMO-01 Accept a request
- **WHEN** a request is submitted
- **THEN** it is stored

#### Scenario: AC-DEMO-02: Reject an empty request
- **WHEN** an empty request is submitted
- **THEN** it is rejected
