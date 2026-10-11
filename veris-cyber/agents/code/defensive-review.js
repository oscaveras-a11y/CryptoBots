import { analyzeProject } from './index.js';

// Read-only defensive review of project files; execution and edits stay behind CORE approvals.
export function defensiveReview(files) {
 const report=analyzeProject(files);
 const priorities={high:0,medium:1,low:2};
 return {
  status:'review_ready',executed:false,
  findings:[...report.findings].sort((a,b)=>(priorities[a.severity]??3)-(priorities[b.severity]??3)),
  checkedFiles:report.files.length,
  limitations:[...report.limitations,'static_review_only','no_exploitation_or_network_scan'],
  recommendedNextStep:'review_findings_and_prepare_approved_patch'
 };
}
