# Sample mock-exam catalogue specification

The six supplied PDFs form three mock-exam records. Each record is a CIMA Management Case Study with four 45-minute tasks and a three-hour unseen question component, but the topic and marking structure differs by mock.

| Mock | Question file | Solution/guide file | Task topic metadata |
| --- | --- | --- | --- |
| Cartn Mock Exam 3 | `cartn-mock-3-questions.pdf` | `cartn-mock-3-solutions.pdf` | Task 1: Risks 60%, Negotiations 40%; Task 2: Disruptive technology 40%; Task 3: Sources of funding 60%, Ratio analysis 40%; Task 4: Pricing 40%, Communication 60%. |
| Cartn Mock Exam 4 | `cartn-mock-4-questions.pdf` | `cartn-mock-4-solutions.pdf` | Task 1: Digital Data Sources 40%, Value management techniques 60%; Task 2: Business Models 60%, Managing stakeholders 40%; Task 3: Risk evaluation techniques 40%, Project management tools 60%; Task 4: Accounting Treatment 60%, Stakeholder management 40%. |
| CIMA MCS Mock B, May & August 2026 | `cima-mock-b-questions.pdf` | `cima-mock-b-answers-marking-guide.pdf` | Task 1: 60%/40%; Task 2: 60%/40%; Task 3: 40%/60%; Task 4: 33%/34%/33%. The answer guide allocates 25, 25, 25, and 25 marks across tasks, with explicit criterion descriptors. |

The PDFs are stored outside the deployed project in `source-pdfs/` pending upload to the managed storage layer. The portal should expose question papers and formulae as protected learner resources, while solutions and marking guides should remain protected until the relevant submission/entitlement rules permit release. The source documents contain third-party publisher branding and copyright notices; they must not be publicly redistributed without the owner’s authorization.
