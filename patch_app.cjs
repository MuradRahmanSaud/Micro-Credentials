const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `                          ) : mcSubTab === "workflow" ? (
                            <div className="flex-1 overflow-hidden relative">
                              <Table 
                                data={workflowData}
                                headers={workflowHeaders}
                                isLoading={isWorkflowLoading}
                                onSave={handleWorkflowSave}
                                onDelete={handleWorkflowDelete}
                                onRefresh={() => fetchWorkflowData(true)}
                                FormPanel={WorkflowPanel}
                                entityName="Workflow"
                                title="Workflow List"
                              />
                            </div>`;

const replacement = `                          ) : mcSubTab === "workflow" ? (
                            <div className="flex-1 overflow-hidden relative">
                              <WorkflowView 
                                data={workflowData}
                                headers={workflowHeaders}
                                isLoading={isWorkflowLoading}
                                onSave={handleWorkflowSave}
                                onDelete={handleWorkflowDelete}
                                onRefresh={() => fetchWorkflowData(true)}
                              />
                            </div>`;

content = content.replace(target, replacement);
fs.writeFileSync('src/App.tsx', content);
