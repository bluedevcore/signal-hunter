// Hunt settings. Edited in code for now; the Settings page shows them.

export const CORE_KEYWORDS = [
  "data entry", "data entry clerk", "administrator", "admin assistant", "office administrator", "bookkeeping assistant",
  "accounts assistant", "purchase ledger", "sales ledger", "social media assistant", "social media executive", "content creator",
  "content assistant", "marketing assistant", "lead generation", "research assistant", "bid writer", "proposal writer",
  "report writer", "transcriber", "customer service email", "virtual assistant", "copywriter", "data analyst",
  "crm administrator", "admin", "secretary", "personal assistant", "operations assistant", "sales administrator", "sales support",
  "order processor", "invoice", "payroll assistant", "credit controller", "accounts payable", "accounts receivable",
  "finance assistant", "marketing executive", "digital marketing assistant", "seo", "content writer", "content executive",
  "ecommerce assistant", "product listing", "listings", "customer service advisor", "customer support", "helpdesk",
  "scheduler", "planner", "coordinator", "compliance administrator", "hr administrator", "recruitment administrator",
  "data administrator", "reporting analyst", "mi analyst", "excel", "transcription", "typist", "proofreader", "translator",
];

export const SENIOR_KEYWORDS = [
  "bid manager", "bid coordinator", "bid executive", "tender manager", "tender coordinator", "proposal manager",
  "management accountant", "financial accountant", "assistant accountant", "financial analyst", "finance analyst",
  "reporting manager", "insights analyst", "commercial analyst", "pricing analyst", "marketing analyst",
  "paralegal", "legal assistant", "conveyancing assistant", "legal secretary",
  "digital marketing manager", "content manager", "seo manager", "ecommerce executive", "ecommerce manager",
  "payroll officer", "payroll specialist", "compliance officer", "document controller", "estimator",
  "paraplanner", "claims handler", "crm manager", "technical writer", "quality administrator",
];

export const SETTINGS = {
  keywords: process.env.HUNT_TEST_KEYWORDS ? process.env.HUNT_TEST_KEYWORDS.split(",") : [...CORE_KEYWORDS, ...SENIOR_KEYWORDS],
  salaryMin: 18000,
  salaryMax: 100000,
  daysBack: 7,
  perKeywordMax: 300, // Reed results per keyword
  maxOpeningsPerEmployer: 6,
};

export const AGENCY = /recruit|staffing|personnel|resourcing|talent|employment|appointments|consult|\bsearch\b|careers|jobs\b|\bjob\b|hays|\breed\b|adecco|randstad|manpower|pertemps|kelly|michael page|page personnel|robert half|tiger|blue arrow|office angels|morson|vanrath|gregory|zachary daniels|mcs group|brook street|sf partners|vickerstock|artemis|experis|mason frank|rullion|network it|network plus|integrate|connect2|honeycomb|ap group|larbey evans|hr ?go|cbs butler|eden brown|sanderson|goodman masson|walters|spencer|harvey nash|nigel frank|jackson hogg|venn group|tate\b|kenda|premier group|platinum|nexus|pareto|hireful|joblink|staff|people\b|partners\b|sacco mann|viqu|qed legal|owen daniels|winsearch|employmint|advocate group|lodestone|montresor|associates|selection|placement|workforce|benjamin edwards|dunwall|ams contingent|outthere/i;
export const PUBLIC = /nhs|council|trust\b|university|college|school|academy|police|government|ministry|hmrc|civil service|borough|county|comhairle|authority|hospital|health ?care|\bcare\b|charity|foundation|housing association|church|diocese|parliament/i;
export const BIG = /\bjll\b|jones lang|gibson dunn|capital group|fender|bosch|booker|warner|pizza hut|dpd|kingspan|pets at home|sodexo|compass|nuffield|amazon|tesco|sainsbury|asda|boots|bupa|deloitte|pwc|kpmg|\bey\b|citi|barclays|hsbc|lloyds|natwest|santander|aviva|bt\b|vodafone|sky\b|bbc|jaguar|rolls|bae|siemens|unilever|gsk|astrazeneca|kier|balfour|mitie|serco|capita|g4s|iss\b|ocs\b|dhl|royal mail|evri|ups\b|pilgrims|plc\b|group\b|teleperformance|sopra steria|grant thornton|eversheds|fieldfisher|norton rose|a&o|allen overy|live nation|e\.on|superdrug|persimmon|nfu mutual/i;
export const SCAM = /survey panel|work at home|remote data entry|paid survey|mystery shop/i;
export const TITLE_STEMS = /data entry|admin|secretar|typist|transcri|order process|bookkeep|accounts|ledger|payroll|invoice|finance assistant|credit control|purchase|social media|content|marketing|seo|copywrit|proofread|translat|lead gen|appointment|bid |proposal|report|mi analyst|data analyst|excel|crm|virtual assistant|personal assistant|operations assistant|sales (admin|support|assistant|coordinator)|ecommerce|e-commerce|listing|customer (service|support)|helpdesk|help desk|scheduler|planner|coordinator|co-ordinator|research assistant|compliance|bid|tender|accountant|analyst|paralegal|legal|conveyanc|estimator|paraplanner|claims handler|document control|quality admin|technical writer/i;
export const HARD_TITLE = /head of|director|principal|chief|partner|engineer|developer|nurse|therap|clinical|systems admin|network admin|sap |cloud|devops|server|receptionist|driver|warehouse|telesales|video|photograph|front of house|events/i;
export const SENIOR_TITLE = /manager|senior|lead\b/i;
export const PRODUCTION = /bid|tender|proposal|accountant|reporting|insight|paralegal|legal|marketing|content|seo|e-?commerce|payroll|compliance|estimator|paraplanner|document control|claims|analyst|crm|bookkeep/i;
export const PHYSICAL = /film|video(grapher|graphy| shoot| production)|photograph|camera|on[- ]camera|presenter|front of house|greet(ing)? (visitors|clients|guests)|reception desk|meet and greet|switchboard|post ?room|franking|stock ?(take|check|room)|warehouse|packing|dispatch|forklift|manual handling|lifting|driv(ing|er)|full (uk )?driving licen[cs]e|site visits?|on site|deliver(ing)? (goods|parcels)|cleaning|kitchen|tea and coffee|refreshments|in[- ]person|face[- ]to[- ]face|influencer/gi;
