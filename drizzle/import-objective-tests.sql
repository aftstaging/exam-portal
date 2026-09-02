-- AFT objective-test practice catalogue import.
-- Creates three purchasable AFT-created Objective test products aligned by
-- professional level (Operational, Management, Strategic), one objective_test
-- mock exam per product, and an original AFT-authored question bank for each.
--
-- All questions are original AFT-created practice material and are labelled as
-- illustrative; they are NOT official CIMA questions.
--
-- Idempotent: every insert is guarded by WHERE NOT EXISTS.

-- ---------------------------------------------------------------------------
-- 1. Products
-- ---------------------------------------------------------------------------
INSERT INTO `products` (`qualificationId`, `title`, `category`, `description`, `priceCents`, `accessDays`, `status`)
SELECT NULL, 'Operational Objective Practice Set', 'objective_test', 'Original AFT-created practice questions for the Operational level (E1/P1/F1): business, performance management and financial reporting fundamentals. 20- or 60-question practice sets and an online mock.', 0, 30, 'published'
WHERE NOT EXISTS (SELECT 1 FROM `products` WHERE `title` = 'Operational Objective Practice Set' AND `category` = 'objective_test');

INSERT INTO `products` (`qualificationId`, `title`, `category`, `description`, `priceCents`, `accessDays`, `status`)
SELECT NULL, 'Management Objective Practice Set', 'objective_test', 'Original AFT-created practice questions for the Management level (E2/P2/F2): project management, advanced management accounting and advanced financial reporting. 20- or 60-question practice sets and an online mock.', 0, 30, 'published'
WHERE NOT EXISTS (SELECT 1 FROM `products` WHERE `title` = 'Management Objective Practice Set' AND `category` = 'objective_test');

INSERT INTO `products` (`qualificationId`, `title`, `category`, `description`, `priceCents`, `accessDays`, `status`)
SELECT NULL, 'Strategic Objective Practice Set', 'objective_test', 'Original AFT-created practice questions for the Strategic level (E3/P3/F3): strategic management, risk management and strategic financial management. 20- or 60-question practice sets and an online mock.', 0, 30, 'published'
WHERE NOT EXISTS (SELECT 1 FROM `products` WHERE `title` = 'Strategic Objective Practice Set' AND `category` = 'objective_test');

SET @pop = (SELECT `id` FROM `products` WHERE `title` = 'Operational Objective Practice Set' AND `category` = 'objective_test' LIMIT 1);
SET @pmp = (SELECT `id` FROM `products` WHERE `title` = 'Management Objective Practice Set' AND `category` = 'objective_test' LIMIT 1);
SET @psp = (SELECT `id` FROM `products` WHERE `title` = 'Strategic Objective Practice Set' AND `category` = 'objective_test' LIMIT 1);

-- ---------------------------------------------------------------------------
-- 2. Mock exams
-- ---------------------------------------------------------------------------
INSERT INTO `mockExams` (`productId`, `title`, `examType`, `intro`, `totalDurationSeconds`, `status`)
SELECT @pop, 'Operational Objective Practice', 'objective_test', 'Original AFT practice covering E1/P1/F1 fundamentals. Choose a 20- or 60-question practice set by topic, or take the online mock in timed conditions.', 5400, 'published'
WHERE NOT EXISTS (SELECT 1 FROM `mockExams` WHERE `title` = 'Operational Objective Practice');

INSERT INTO `mockExams` (`productId`, `title`, `examType`, `intro`, `totalDurationSeconds`, `status`)
SELECT @pmp, 'Management Objective Practice', 'objective_test', 'Original AFT practice covering E2/P2/F2. Choose a 20- or 60-question practice set by topic, or take the online mock in timed conditions.', 5400, 'published'
WHERE NOT EXISTS (SELECT 1 FROM `mockExams` WHERE `title` = 'Management Objective Practice');

INSERT INTO `mockExams` (`productId`, `title`, `examType`, `intro`, `totalDurationSeconds`, `status`)
SELECT @psp, 'Strategic Objective Practice', 'objective_test', 'Original AFT practice covering E3/P3/F3. Choose a 20- or 60-question practice set by topic, or take the online mock in timed conditions.', 5400, 'published'
WHERE NOT EXISTS (SELECT 1 FROM `mockExams` WHERE `title` = 'Strategic Objective Practice');

SET @mop = (SELECT `id` FROM `mockExams` WHERE `title` = 'Operational Objective Practice' LIMIT 1);
SET @mmp = (SELECT `id` FROM `mockExams` WHERE `title` = 'Management Objective Practice' LIMIT 1);
SET @msp = (SELECT `id` FROM `mockExams` WHERE `title` = 'Strategic Objective Practice' LIMIT 1);

-- ---------------------------------------------------------------------------
-- 3. Operational question bank (E1/P1/F1 topics)
-- ---------------------------------------------------------------------------
INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mop,'Cost behaviour','C1','single_choice','A cost that remains constant in total within a relevant range of activity but varies per unit as activity changes is known as:','["A fixed cost","A step cost","A variable cost","A semi-variable cost"]','0','A fixed cost stays the same in total over the relevant range, so the cost per unit falls as activity rises. A variable cost changes in total with activity but is constant per unit.','easy','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'A cost that remains constant in total within a relevant range of activity but varies per unit as activity changes is known as:');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mop,'Cost behaviour','C1','numerical','A business has fixed costs of R120,000 per month and variable costs of R40 per unit. If it produces and sells 3,000 units in a month, what is the total cost (in rand) for that month?','[]','"240000"','Total cost = fixed + (variable per unit x units) = 120,000 + (40 x 3,000) = 120,000 + 120,000 = 240,000.','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'A business has fixed costs of R120,000 per month and variable costs of R40 per unit. If it produces and sells 3,000 units in a month, what is the total cost (in rand) for that month?');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mop,'Cost behaviour','C1','single_choice','Which cost is classified as a period cost rather than a product cost?','["Direct materials","Direct labour","Administrative salaries","Factory rent"]','2','Administrative salaries are period costs, expensed in the period incurred. Direct materials, direct labour and (typically) factory rent are product costs capitalised into inventory.','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'Which cost is classified as a period cost rather than a product cost?');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mop,'Cost behaviour','C1','multiple_choice','Which two of the following are examples of variable costs?','["Direct material","Straight-line depreciation","Machine rental on a fixed lease","Sales commission per unit","Annual insurance premium"]','[0,3]','Direct material and sales commission per unit vary with the level of activity. Depreciation, fixed machine rental and insurance are fixed.','easy','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'Which two of the following are examples of variable costs?');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mop,'Costing methods','C2','single_choice','Under absorption costing, fixed production overheads are:','["Expensed in the period incurred","Treated as a period cost","Absorbed into the cost of units produced","Ignored in inventory valuation"]','2','Absorption costing assigns fixed production overheads to units of output through an overhead absorption rate, so they are included in inventory valuation.','easy','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'Under absorption costing, fixed production overheads are:');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mop,'Costing methods','C2','numerical','A company uses a pre-determined overhead absorption rate based on direct labour hours. Budgeted overheads are R250,000 and budgeted direct labour hours are 10,000. What is the absorption rate per direct labour hour (in rand)?','[]','"25"','Rate = budgeted overhead / budgeted labour hours = 250,000 / 10,000 = R25 per hour.','easy','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'A company uses a pre-determined overhead absorption rate based on direct labour hours. Budgeted overheads are R250,000 and budgeted direct labour hours are 10,000. What is the absorption rate per direct labour hour (in rand)?');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mop,'Costing methods','C2','single_choice','The main advantage of marginal costing relative to absorption costing is that it:','["Complies with financial reporting standards","Avoids the arbitrary apportionment of fixed overheads","Values inventory at full production cost","Includes fixed overheads in product cost"]','1','Marginal costing treats only variable costs as product costs and avoids the arbitrary allocation of fixed overheads between products, which is useful for short-term decision-making.','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'The main advantage of marginal costing relative to absorption costing is that it:');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mop,'Costing methods','C2','single_choice','In a marginal costing income statement, contribution is calculated as:','["Sales less full production cost","Sales less variable costs","Fixed costs less variable costs","Sales less cost of sales and overheads"]','1','Contribution = sales revenue less total variable costs. It is the amount that contributes towards covering fixed costs and generating profit.','easy','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'In a marginal costing income statement, contribution is calculated as:');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mop,'Financial reporting','F1','single_choice','Which financial statement reports a company''s financial position at a point in time?','["Income statement","Statement of cash flows","Statement of financial position (balance sheet)","Statement of changes in equity"]','2','The statement of financial position reports assets, liabilities and equity at a specific date. The income statement and cash flow statement cover a period.','easy','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'Which financial statement reports a company''s financial position at a point in time?');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mop,'Financial reporting','F1','single_choice','Under the accruals (matching) basis of accounting, revenue is recognised when:','["Cash is received","It is earned, regardless of when cash is received","The invoice is sent","The goods are paid for"]','1','Accruals basis recognises revenue when it is earned (goods delivered or services performed), not necessarily when cash changes hands.','easy','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'Under the accruals (matching) basis of accounting, revenue is recognised when:');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mop,'Financial reporting','F1','numerical','A company has current assets of R500,000 and current liabilities of R200,000. What is its current ratio?','[]','"2.5"','Current ratio = current assets / current liabilities = 500,000 / 200,000 = 2.5:1.','easy','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'A company has current assets of R500,000 and current liabilities of R200,000. What is its current ratio?');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mop,'Financial reporting','F1','single_choice','Which of the following would appear as a current asset?','["Loan repayable in five years","Inventory held for resale","Equipment used in operations","Share capital"]','1','Inventory held for resale is a current asset, expected to be converted to cash within the operating cycle. A long-term loan is a non-current liability; equipment is non-current; share capital is equity.','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'Which of the following would appear as a current asset?');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mop,'Break-even','C3','numerical','A product sells for R50 per unit, has variable costs of R30 per unit, and fixed costs of R80,000. How many units must be sold to break even?','[]','"4000"','Break-even = fixed costs / contribution per unit = 80,000 / (50 - 30) = 80,000 / 20 = 4,000 units.','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'A product sells for R50 per unit, has variable costs of R30 per unit, and fixed costs of R80,000. How many units must be sold to break even?');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mop,'Break-even','C3','single_choice','The margin of safety is:','["The excess of budgeted sales over break-even sales","The excess of contribution over profit","Fixed costs divided by contribution ratio","Sales less variable costs"]','0','Margin of safety measures how far sales can fall below budget before the business reaches break-even.','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'The margin of safety is:');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mop,'Break-even','C3','single_choice','If the contribution/sales (C/S) ratio is 40% and fixed costs are R120,000, the break-even revenue (in rand) is:','["R48,000","R300,000","R200,000","R480,000"]','1','Break-even revenue = fixed costs / C/S ratio = 120,000 / 0.40 = R300,000.','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'If the contribution/sales (C/S) ratio is 40% and fixed costs are R120,000, the break-even revenue (in rand) is:');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mop,'Business & commercial','E1','single_choice','Which of the following is a macro-environmental factor in a PESTEL analysis?','["Supplier bargaining power","Interest rates","Customer loyalty","Internal staff morale"]','1','Interest rates are part of the economic macro-environment assessed in PESTEL analysis. The others are industry- or firm-level factors.','easy','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'Which of the following is a macro-environmental factor in a PESTEL analysis?');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mop,'Business & commercial','E1','single_choice','Which structure groups employees by specialist function such as marketing, finance and production?','["Matrix structure","Divisional structure","Functional structure","Flat structure"]','2','A functional structure groups employees by specialism (e.g., finance, marketing, production).','easy','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'Which structure groups employees by specialist function such as marketing, finance and production?');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mop,'Business & commercial','E1','single_choice','The main purpose of corporate governance is to:','["Maximise short-term share price","Direct and control the company for the benefit of stakeholders","Eliminate all business risk","Guarantee dividends to shareholders"]','1','Corporate governance is the system by which companies are directed and controlled, providing accountability to stakeholders.','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'The main purpose of corporate governance is to:');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mop,'Business & commercial','E1','multiple_choice','Which two of the following are examples of intangible assets?','["Brand name","Delivery vehicles","Computer software licence","Raw materials inventory","Cash at bank"]','[0,2]','A brand name and a software licence are non-physical, recognisable intangible assets. Vehicles are tangible, and inventory and cash are current assets.','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'Which two of the following are examples of intangible assets?');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mop,'Business & commercial','E1','single_choice','Which stakeholder group is most directly concerned with the going concern of a business because they have lent it long-term money?','["Suppliers","Lenders (providers of loan finance)","Competitors","The general public"]','1','Lenders are financially exposed through long-term debt and are therefore directly concerned with the entity''s financial stability and going concern.','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'Which stakeholder group is most directly concerned with the going concern of a business because they have lent it long-term money?');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mop,'Inventory','F1','single_choice','Under FIFO, the cost of closing inventory is based on:','["The most recent purchase prices","The oldest purchase prices","The average purchase price","The lowest purchase price"]','0','FIFO assumes the earliest goods are sold first, leaving the most recently purchased (latest) goods in closing inventory at their more recent prices.','easy','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'Under FIFO, the cost of closing inventory is based on:');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mop,'Inventory','F1','numerical','A business has opening inventory of R90,000, purchases of R210,000, and closing inventory of R120,000. What is the cost of sales (in rand)?','[]','"180000"','Cost of sales = opening inventory + purchases - closing inventory = 90,000 + 210,000 - 120,000 = 180,000.','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'A business has opening inventory of R90,000, purchases of R210,000, and closing inventory of R120,000. What is the cost of sales (in rand)?');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mop,'Inventory','F1','single_choice','The economic order quantity (EOQ) model balances:','["Ordering costs against holding costs","Fixed costs against variable costs","Direct versus indirect costs","Budgeted against actual costs"]','0','EOQ minimises the total of ordering costs and inventory holding (carrying) costs, identifying the most economical batch size.','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'The economic order quantity (EOQ) model balances:');

-- ---------------------------------------------------------------------------
-- 4. Management question bank (E2/P2/F2 topics)
-- ---------------------------------------------------------------------------
INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mmp,'Budgeting','P2','single_choice','A budget prepared by each manager and consolidated upwards is best described as a:','["Top-down (imposed) budget","Bottom-up (participative) budget","Zero-based budget","Rolling budget"]','1','A bottom-up (participative) budget is built from the input of lower-level managers and consolidated upwards, increasing ownership but risking budgetary slack.','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'A budget prepared by each manager and consolidated upwards is best described as a:');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mmp,'Budgeting','P2','single_choice','Budgetary slack refers to:','["The deliberate understatement of revenues or overstatement of costs","The difference between fixed and variable costs","The cushion of cash kept for emergencies","The variance between budget and actual"]','0','Budgetary slack is intentionally building excess capacity into a budget, e.g., understating revenue or overstating cost, to make targets easier to achieve.','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'Budgetary slack refers to:');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mmp,'Budgeting','P2','numerical','A company budgets sales of 12,000 units. Production (units) is required if opening inventory is 1,000 units and closing inventory should be 1,500 units?','[]','"12500"','Production = sales + closing inventory - opening inventory = 12,000 + 1,500 - 1,000 = 12,500 units.','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'A company budgets sales of 12,000 units. Production (units) is required if opening inventory is 1,000 units and closing inventory should be 1,500 units?');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mmp,'Budgeting','P2','single_choice','The cash budget differs from the profit statement primarily because it:','["Records transactions when cash moves, not when they are earned or incurred","Includes non-cash depreciation","Ignores payments to suppliers","Only covers a single month"]','0','A cash budget records cash inflows and outflows on a movement-of-cash basis, whereas the profit statement uses accruals. Depreciation is non-cash and would appear only in the profit statement.','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'The cash budget differs from the profit statement primarily because it:');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mmp,'Budgeting','P2','multiple_choice','Which two of the following are benefits of participative budgeting?','["Greater ownership and commitment by managers","Reduces the risk of budgetary slack","Incorporates honest, local knowledge","Removes the need for periodic review"]','[0,2]','Participative budgeting improves commitment and uses the local knowledge of managers. It does not automatically reduce slack (it can increase it) and still requires review.','easy','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'Which two of the following are benefits of participative budgeting?');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mmp,'Performance management','P2','single_choice','Which ratio measures how effectively a business is using its non-current assets to generate revenue?','["Asset turnover","Current ratio","Gross profit margin","Gearing ratio"]','0','Asset turnover = revenue / capital employed (or non-current assets) and measures the efficiency of asset use in generating sales.','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'Which ratio measures how effectively a business is using its non-current assets to generate revenue?');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mmp,'Performance management','P2','numerical','A division has operating profit of R150,000 and capital employed of R750,000. What is its return on capital employed (ROCE) as a percentage?','[]','"20"','ROCE = profit before interest and tax / capital employed x 100 = 150,000 / 750,000 x 100 = 20%.','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'A division has operating profit of R150,000 and capital employed of R750,000. What is its return on capital employed (ROCE) as a percentage?');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mmp,'Performance management','P2','single_choice','A balanced scorecard emphasises financial measures together with which three other perspectives?','["Customer, internal processes, and learning and growth","Suppliers, competitors, and regulators","Profit, cash, and liquidity","Cost, quality, and time"]','0','The balanced scorecard (Kaplan and Norton) combines financial, customer, internal business process, and learning and growth perspectives.','easy','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'A balanced scorecard emphasises financial measures together with which three other perspectives?');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mmp,'Performance management','P2','single_choice','A favourable material price variance indicates that:','["Material was purchased at a lower price than standard","More material was used than standard","Material waste was higher than expected","The purchase price exceeded standard"]','0','A favourable material price variance means actual purchase price was below the standard price, spending less than allowed on materials.','easy','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'A favourable material price variance indicates that:');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mmp,'Performance management','P2','numerical','Standard labour hours for output are 500 hours, but actual labour hours are 550 hours. The labour efficiency variance in hours is an adverse figure of:','[]','"50"','Labour efficiency variance = standard hours - actual hours = 500 - 550 = -50; adverse by 50 hours (more hours used than standard).','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'Standard labour hours for output are 500 hours, but actual labour hours are 550 hours. The labour efficiency variance in hours is an adverse figure of:');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mmp,'Project management','E2','single_choice','Which of the following is the correct order of the generic project lifecycle stages?','["Initiation, planning, execution, closure","Planning, initiation, closure, execution","Execution, planning, initiation, closure","Initiation, execution, planning, closure"]','0','Projects typically move through initiation, planning, execution (monitoring and control), and closure.','easy','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'Which of the following is the correct order of the generic project lifecycle stages?');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mmp,'Project management','E2','single_choice','In a project network diagram, the critical path is:','["The sequence of activities with the longest total duration","The path with the least total cost","The sequence of activities with the shortest duration","Any path that does not have float"]','0','The critical path is the chain of dependent activities that determines the minimum project completion time; it has zero float and any delay on it delays the whole project.','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'In a project network diagram, the critical path is:');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mmp,'Project management','E2','single_choice','A project''s total float (slack) is best described as:','["The amount of time an activity can be delayed without delaying the project finish","The buffer between actual and budgeted cost","The extra time allocated to the critical path","The difference between optimistic and pessimistic estimates"]','0','Total float is the time an activity can be delayed before it delays the project completion. Activities on the critical path have zero float.','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'A project''s total float (slack) is best described as:');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mmp,'Project management','E2','multiple_choice','Which two of the following are common causes of project overruns?','["Unrealistic initial estimates","Poor scope control","Excessively detailed documentation","Over-generous contingency reserves"]','[0,1]','Unrealistic estimates and poor scope control frequently drive time and cost overruns. Detailed documentation and large contingency reserves are not typical causes of overruns.','easy','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'Which two of the following are common causes of project overruns?');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mmp,'Project management','E2','single_choice','The project charter is primarily used to:','["Formally authorise the project and define its scope and objectives","Record the final lessons learned","Track day-to-day task progress","Set the marketing budget"]','0','The project charter authorises the project, names the sponsor, and states the objectives and broad scope. It is produced early in initiation.','easy','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'The project charter is primarily used to:');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mmp,'Advanced financial reporting','F2','single_choice','A dividend declared but not yet paid should be classified in the statement of financial position as:','["An asset","A current liability","Equity","A contingent liability"]','1','A declared, unpaid dividend is a current liability payable to shareholders until it is settled.','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'A dividend declared but not yet paid should be classified in the statement of financial position as:');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mmp,'Advanced financial reporting','F2','single_choice','In a consolidated statement of financial position, the parent''s investment in the subsidiary is:','["Shown as a non-current asset","Eliminated against the subsidiary''s equity","Recorded at market value each year","Disclosed only in the notes"]','1','On consolidation, the parent''s investment is eliminated against the net assets/equity of the subsidiary to avoid double counting.','hard','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'In a consolidated statement of financial position, the parent''s investment in the subsidiary is:');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mmp,'Advanced financial reporting','F2','numerical','A machine cost R400,000 and has a useful life of 5 years with nil residual value. Using straight-line depreciation, what is the annual depreciation charge (in rand)?','[]','"80000"','Annual depreciation = (cost - residual value) / useful life = 400,000 / 5 = R80,000 per year.','easy','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'A machine cost R400,000 and has a useful life of 5 years with nil residual value. Using straight-line depreciation, what is the annual depreciation charge (in rand)?');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mmp,'Advanced financial reporting','F2','single_choice','A provision is recognised when:','["There is a present obligation from a past event with a probable outflow that can be measured reliably","The business expects a future loss","A customer has placed an order","Management intends to make a donation next year"]','0','A provision meets the criteria of a present obligation as a result of a past event, probable outflow, and a reliably estimable amount.','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'A provision is recognised when:');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @mmp,'Advanced financial reporting','F2','single_choice','The going concern assumption means that:','["The entity is expected to continue operating for the foreseeable future","The entity is likely to be liquidated soon","Assets must always be recorded at market value","All liabilities must be settled immediately"]','0','Going concern assumes the entity will continue in operation for the foreseeable future, so assets are not valued at forced-sale values.','easy','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'The going concern assumption means that:');

-- ---------------------------------------------------------------------------
-- 5. Strategic question bank (E3/P3/F3 topics)
-- ---------------------------------------------------------------------------
INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @msp,'Strategic management','E3','single_choice','According to Porter, which of the following is a generic competitive strategy?','["Cost leadership","Market skimming","Conglomerate integration","Backward diversification"]','0','Porter''s generic strategies are cost leadership, differentiation, and focus (cost focus / differentiation focus).','easy','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'According to Porter, which of the following is a generic competitive strategy?');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @msp,'Strategic management','E3','single_choice','Ansoff''s matrix categorises growth strategies along which two dimensions?','["Product and market","Cost and price","Strength and weakness","Supply and demand"]','0','Ansoff''s matrix considers whether a strategy involves new or existing products and new or existing markets.','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'Ansoff''s matrix categorises growth strategies along which two dimensions?');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @msp,'Strategic management','E3','single_choice','A SWOT analysis examines a company''s:','["Strengths, weaknesses, opportunities and threats","Sales, wages, overheads and tax","Risks, returns, rewards and regulation","Suppliers, workers, owners and trade"]','0','SWOT stands for Strengths, Weaknesses, Opportunities and Threats; the first two are internal, the last two external.','easy','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'A SWOT analysis examines a company''s:');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @msp,'Strategic management','E3','multiple_choice','Which two of the following are examples of diversification risks or challenges a company may face?','["Entering an unfamiliar market with limited experience","Potential loss of focus from the current core business","Guaranteed higher returns with no new capital","Elimination of all competitive rivalry"]','[0,1]','Diversification into unfamiliar markets carries execution risk and can dilute focus on the core business. It does not guarantee returns or remove rivalry.','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'Which two of the following are examples of diversification risks or challenges a company may face?');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @msp,'Strategic management','E3','single_choice','Corporate strategy answers the question:','["What businesses should the organisation be in and how should its resources be deployed across them?","Which employee should fill each role this month?","How should a single product be priced today?","Which supplier offers the lowest unit price?"]','0','Corporate strategy concerns the overall scope and direction of the organisation and how resources are allocated across business units.','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'Corporate strategy answers the question:');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @msp,'Risk management','P3','single_choice','Which response involves taking action to reduce the likelihood or impact of a risk?','["Risk mitigation","Risk acceptance","Risk avoidance","Risk transfer"]','0','Risk mitigation reduces the probability or impact of a risk. Avoidance eliminates it, transfer shifts it (e.g., insurance), and acceptance retains it.','easy','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'Which response involves taking action to reduce the likelihood or impact of a risk?');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @msp,'Risk management','P3','single_choice','Purchasing an insurance policy is an example of which risk treatment?','["Risk transfer","Risk avoidance","Risk acceptance","Risk retention"]','0','Insurance shifts the financial consequence of a risk to a third party, i.e., risk transfer.','easy','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'Purchasing an insurance policy is an example of which risk treatment?');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @msp,'Risk management','P3','single_choice','A risk with high impact and high likelihood would normally be placed in which zone of a risk map?','["Immediate action / high priority zone","Acceptable / low priority zone","Residual risk zone","Opportunity zone"]','0','High-likelihood, high-impact risks fall in the high-priority band of a risk map and require urgent mitigation.','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'A risk with high impact and high likelihood would normally be placed in which zone of a risk map?');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @msp,'Risk management','P3','single_choice','The beta of a company''s shares is a measure of:','["Systematic (market) risk relative to the market","Idiosyncratic (specific) risk only","Liquidity risk only","Interest rate risk only"]','0','Beta measures a share''s systematic risk — its sensitivity to overall market movements — relative to the market as a whole.','hard','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'The beta of a company''s shares is a measure of:');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @msp,'Risk management','P3','multiple_choice','Which two of the following are examples of financial (market) risks?','["Interest rate movements","Currency (exchange rate) fluctuations","A key employee resigning","Damage to a factory in a storm"]','[0,1]','Interest rate and currency movements are financial/market risks. Key-person loss is operational; storm damage is a physical/hazard risk.','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'Which two of the following are examples of financial (market) risks?');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @msp,'Strategic financial management','F3','single_choice','The theoretical advantage of raising finance through retained earnings over a new share issue is that:','["It avoids issue costs and does not dilute existing shareholdings","It is always risk-free","It reduces the weighted average cost of capital to zero","It requires no reinvestment of profit"]','0','Retained earnings involve no issue/floatation costs and avoid diluting existing shareholders'' ownership (though some argue there is still an opportunity cost).','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'The theoretical advantage of raising finance through retained earnings over a new share issue is that:');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @msp,'Strategic financial management','F3','single_choice','Net present value (NPV) is preferred to payback period as an investment appraisal method primarily because it:','["Considers the time value of money and all project cash flows","Is easier to calculate","Ignores the cost of capital","Uses accounting profit rather than cash flow"]','0','NPV discounts all future cash flows back to present value, recognising the time value of money, and considers the entire project life — unlike the simple payback period.','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'Net present value (NPV) is preferred to payback period as an investment appraisal method primarily because it:');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @msp,'Strategic financial management','F3','numerical','An investment of R1,000,000 is expected to generate annual cash inflows of R250,000 for 6 years. What is the simple payback period in years?','[]','"4"','Payback = initial investment / annual cash inflow = 1,000,000 / 250,000 = 4 years.','easy','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'An investment of R1,000,000 is expected to generate annual cash inflows of R250,000 for 6 years. What is the simple payback period in years?');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @msp,'Strategic financial management','F3','single_choice','The internal rate of return (IRR) is the discount rate at which:','["The NPV of the project equals zero","The payback period equals zero","Accounting profit equals cash flow","The cost of capital is maximised"]','0','IRR is the discount rate that makes the NPV of a project''s cash flows equal to zero.','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'The internal rate of return (IRR) is the discount rate at which:');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @msp,'Strategic financial management','F3','single_choice','Which of the following best describes the weighted average cost of capital (WACC)?','["The average rate a company is expected to pay to finance its assets","The marginal tax rate of the company","The return on the market portfolio","The company''s dividend per share"]','0','WACC is the blended cost of the company''s debt and equity financing, weighted by their proportions in the capital structure.','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'Which of the following best describes the weighted average cost of capital (WACC)?');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @msp,'Strategic financial management','F3','single_choice','When assessing a merger, the value created for shareholders is usually measured by:','["The present value of expected incremental cash flows (synergies)","The number of new board members","The historic share price only","The total value of brands advertised"]','0','Merger value to shareholders is best reflected in the present value of expected synergies and incremental cash flows arising from the combination.','hard','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'When assessing a merger, the value created for shareholders is usually measured by:');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @msp,'Strategic financial management','F3','numerical','A company pays a constant dividend of R2.50 per share. If its cost of equity is 10%, what is the value of the share under the dividend valuation model (in rand)?','[]','"25"','Value = dividend / cost of equity = 2.50 / 0.10 = R25 per share.','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'A company pays a constant dividend of R2.50 per share. If its cost of equity is 10%, what is the value of the share under the dividend valuation model (in rand)?');

INSERT INTO `objectiveQuestions` (`mockExamId`,`topic`,`learningOutcome`,`questionType`,`prompt`,`optionsJson`,`answerJson`,`explanation`,`difficulty`,`status`)
SELECT @msp,'Strategic financial management','F3','single_choice','Which financing source generally carries the lowest required rate of return for a company because it is repaid before shareholders?','["Debt (borrowings)","Ordinary shares","Preference shares","Retained earnings"]','0','Debt is typically the cheapest source of finance as interest is tax-deductible and lenders face lower risk (priority repayment) than shareholders.','medium','published'
WHERE NOT EXISTS (SELECT 1 FROM `objectiveQuestions` WHERE `prompt` = 'Which financing source generally carries the lowest required rate of return for a company because it is repaid before shareholders?');

