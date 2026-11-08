const $ = (selector) => document.querySelector(selector);
const taskInput = $('#taskInput');
const repoInput = $('#repoInput');
const modalRoot = $('#modalRoot');
let config = {};
let selectedKind = 'fix';
let activePlan = null;
let runStarted = 0;
let demoRepoPath = '';

function toast(message, duration = 3400) {
  const el = $('#toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), duration);
}
async function api(url, data) {
  const response = await fetch(url, data ? { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) } : {});
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
  return result;
}
function escapeHtml(text) { return String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function updateBudget(session = {}) {
  const spent = Number(session.spent || 0), limit = Math.max(0, Number($('#budgetInput').value) || .5);
  $('#budgetUsed').textContent = `$${spent.toFixed(4)}`;
  $('#budgetLimitText').textContent = `$${limit.toFixed(2)} limit`;
  $('#budgetLeft').textContent = `$${Math.max(0, limit-spent).toFixed(4)} left`;
  $('#budgetBar').style.width = `${Math.min(100, limit ? spent/limit*100 : 0)}%`;
}
function setBusy(value) {
  $('#planBtn').disabled = value;
  $('#planBtn span').textContent = value ? 'Working…' : 'Plan task';
}
function startFeed() {
  $('#activityBody').innerHTML = '<div class="feed" id="feed"></div>';
  $('#runStatus').textContent = 'RUNNING';
}
function feedRow(title, detail, pending = false) {
  const row = document.createElement('div'); row.className = `feed-row${pending ? ' pending':''}`;
  const text = document.createElement('div'); text.className = 'feed-text';
  const heading = document.createElement('b'); heading.textContent = title;
  const sub = document.createElement('span'); sub.textContent = detail;
  text.append(heading, sub); row.innerHTML = '<span class="feed-bullet">✓</span>'; row.append(text);
  $('#feed').append(row); return row;
}
function doneRow(row, detail) { row.classList.remove('pending'); row.querySelector('.feed-bullet').textContent = '✓'; row.querySelector('.feed-text span').textContent = detail; }
function diffModal(plan) {
  activePlan = plan;
  modalRoot.innerHTML = '';
  const back = document.createElement('div'); back.className = 'modal-backdrop';
  const modal = document.createElement('section'); modal.className = 'modal';
  const h = document.createElement('h3'); h.textContent = plan.empty ? 'No file changes proposed' : 'Review the proposed change';
  const p = document.createElement('p'); p.textContent = `${plan.summary} · ${plan.repo}`;
  modal.append(h,p);
  if (plan.empty) {
    const info = document.createElement('p'); info.textContent = 'The model could not propose a safe edit from the selected context. Try a more specific task.'; modal.append(info);
  }
  for (const change of plan.changes) {
    const title = document.createElement('p'); title.textContent = `${change.path} — ${change.rationale}`; modal.append(title);
    const pre = document.createElement('pre');
    for (const line of change.diff.split('\n')) {
      const span = document.createElement('span'); span.textContent = line+'\n';
      if (line.startsWith('+') && !line.startsWith('+++')) span.className='diff-add';
      if (line.startsWith('-') && !line.startsWith('---')) span.className='diff-del';
      pre.append(span);
    }
    modal.append(pre);
  }
  const actions = document.createElement('div'); actions.className='modal-actions';
  const cancel=document.createElement('button');cancel.textContent=plan.empty?'Close':'Reject proposal';cancel.onclick=()=>{modalRoot.innerHTML='';$('#runStatus').textContent='REVIEWED';};actions.append(cancel);
  if (!plan.empty) {const approve=document.createElement('button');approve.className='approve';approve.textContent='Approve and write';approve.onclick=applyPlan;actions.append(approve);}
  modal.append(actions);back.append(modal);modalRoot.append(back);
}
async function applyPlan() {
  if(!activePlan)return;
  const approve=$('.modal-actions .approve');if(approve){approve.disabled=true;approve.textContent='Applying…';}
  try {
    const result=await api('/api/apply',{id:activePlan.id,approvalHash:activePlan.approvalHash});
    modalRoot.innerHTML='';
    const row=feedRow('Approved changes written',result.wrote.join(', '));
    $('#runStatus').textContent='CHANGES APPLIED';
    const command=String(result.verification||'python -m unittest discover -s tests').trim();
    showCommandApproval(command);
  } catch(err) { if(approve){approve.disabled=false;approve.textContent='Approve and write';} toast(err.message,5500); }
}
function showCommandApproval(command) {
  modalRoot.innerHTML='';const back=document.createElement('div');back.className='modal-backdrop';const modal=document.createElement('section');modal.className='modal';
  const h=document.createElement('h3');h.textContent='Run verification command?';const p=document.createElement('p');p.textContent='Shell commands need separate approval. Review the exact command and working folder.';
  const pre=document.createElement('pre');pre.textContent=`${command}\n\nWorking directory: ${activePlan.repo}`;
  const actions=document.createElement('div');actions.className='modal-actions';const skip=document.createElement('button');skip.textContent='Skip';skip.onclick=()=>modalRoot.innerHTML='';const go=document.createElement('button');go.className='approve';go.textContent='Approve and run';go.onclick=()=>runCommand(command,go);actions.append(skip,go);modal.append(h,p,pre,actions);back.append(modal);modalRoot.append(back);
}
async function runCommand(command, button) {
  button.disabled=true;button.textContent='Running…';
  try {
    const result=await api('/api/run-command',{id:activePlan.id,command});modalRoot.innerHTML='';
    const text=(result.stdout+'\n'+result.stderr).trim()||'(No output)';
    const row=feedRow(result.code===0?'Verification passed':'Verification failed',`${command} · exit code ${result.code}`);
    const pre=document.createElement('pre');pre.className='diff-block';pre.textContent=text;$('#feed').append(pre);
    $('#runStatus').textContent=result.code===0?'VERIFIED':'CHECK FAILED';toast(result.code===0?'Verification passed.':'Command finished with errors.');
  } catch(err){button.disabled=false;button.textContent='Approve and run';toast(err.message,5000);}
}
function renderPlan(plan) {
  const selected=feedRow('Surgical repository search complete',`${plan.filesRead.length} source files sent · ${plan.filesSkipped} other code files skipped · ${plan.totalFiles} discovered`);
  if(plan.contextDocs.length) {const row=feedRow('Project context loaded',plan.contextDocs.join(', '));}
  const modelRow=feedRow('Budget approved · model response received',`${plan.inputTokens.toLocaleString()} input tokens · ${plan.costIsEstimate?'estimated ':'reported '}$${plan.cost.toFixed(5)} · ${plan.model} via ${plan.provider}`);
  const names=document.createElement('div');names.style.margin='0 0 5px 23px';
  for(const file of plan.filesRead){const chip=document.createElement('span');chip.className='file-chip';chip.textContent=file;names.append(chip);}
  $('#feed').append(names);
  $('#filesMetric').textContent=String(plan.filesRead.length);$('#filesSub').textContent=`${plan.filesSkipped} irrelevant files skipped`;
  $('#tokensMetric').textContent=plan.inputTokens.toLocaleString();$('#tokensSub').textContent=plan.tokensAreEstimate?'Estimated before call':'Provider-reported input';
  $('#costMetric').textContent=`$${plan.cost.toFixed(4)}`;$('#costSub').textContent=plan.costIsEstimate?'Estimated from configured model rates':'Provider reported';
  $('#timeMetric').textContent=`${(plan.elapsedMs/1000).toFixed(1)}s`;
  $('#routeLabel').textContent=`${plan.model} · ${plan.provider}${$('#confidential').checked?' · confidential':''}`;
  $('#activitySub').textContent=plan.empty?'No safe change proposed':'Plan ready · review the diff before writing';
  $('#runStatus').textContent=plan.empty?'NO CHANGE':'REVIEW DIFF';
  doneRow(selected,`${plan.filesRead.length} source files selected from ${plan.totalFiles} discovered`);
  doneRow(modelRow,`${plan.inputTokens.toLocaleString()} input tokens · ${plan.costIsEstimate?'estimated ':'reported'} $${plan.cost.toFixed(5)} · ${plan.model}`);
  updateBudget({spent:plan.sessionSpent});diffModal(plan);
}
async function planTask() {
  const task=taskInput.value.trim(),repo=repoInput.value.trim();
  if(!repo){toast('Choose a repository folder first.');repoInput.focus();return;}
  if(!task){toast('Describe a bug fix, feature, or refactor first.');taskInput.focus();return;}
  setBusy(true);runStarted=performance.now();startFeed();
  const scan=feedRow('Finding relevant files','Checking project notes, filenames, and source symbols…',true);
  $('#filesMetric').textContent='…';$('#tokensMetric').textContent='…';$('#costMetric').textContent='Checking';$('#timeMetric').textContent='…';
  try {
    const plan=await api('/api/plan',{task,repo,kind:selectedKind,provider:$('#provider').value,confidential:$('#confidential').checked,budget:Number($('#budgetInput').value)});
    plan.sessionSpent=(await api('/api/status')).session.spent;
    doneRow(scan,`${plan.filesRead.length} relevant files selected · ${plan.totalFiles} source files found`);
    renderPlan(plan);
  } catch(err) {
    doneRow(scan,'Could not complete the planning step.');
    const row=feedRow('Action stopped safely',err.message);
    $('#runStatus').textContent='STOPPED';$('#activitySub').textContent='No file changes were made';
    $('#timeMetric').textContent=`${((performance.now()-runStarted)/1000).toFixed(1)}s`;
    updateBudget((await api('/api/status').catch(()=>({session:{}}))).session);
    toast(err.message,6500);
  } finally {setBusy(false);}
}
function openSettings() {
  modalRoot.innerHTML='';const back=document.createElement('div');back.className='modal-backdrop';const modal=document.createElement('section');modal.className='modal';
  const h=document.createElement('h3');h.textContent='Model and budget settings';const p=document.createElement('p');p.textContent='Ollama is the default local route. The Bifrost key stays in this running server process and is never saved to disk.';
  modal.append(h,p);
  const form=document.createElement('div');form.className='settings-form';form.innerHTML=`<label>Ollama endpoint<input id="setOllamaUrl" value="${escapeHtml(config.ollamaUrl||'http://127.0.0.1:11434/v1')}"></label><label>Ollama model<input id="setOllamaModel" value="${escapeHtml(config.ollamaModel||'qwen2.5-coder:3b')}"></label><label>Bifrost endpoint<input id="setBifrostUrl" value="${escapeHtml(config.bifrostUrl||'http://127.0.0.1:8080/v1')}"></label><label>Bifrost model alias<input id="setBifrostModel" value="${escapeHtml(config.bifrostModel||'openai/gpt-4o-mini')}"></label><label>Bifrost API key · memory only<input id="setBifrostKey" type="password" autocomplete="off" placeholder="Paste key for this run"></label><div class="rate-grid"><label>Input rate · USD / 1M tokens<input id="setInputRate" type="number" min="0" step="0.01" value="${Number(config.inputRate||0)}"></label><label>Output rate · USD / 1M tokens<input id="setOutputRate" type="number" min="0" step="0.01" value="${Number(config.outputRate||0)}"></label></div>`;
  const actions=document.createElement('div');actions.className='modal-actions';const close=document.createElement('button');close.textContent='Cancel';close.onclick=()=>modalRoot.innerHTML='';const save=document.createElement('button');save.className='approve';save.textContent='Save settings';save.onclick=saveSettings;actions.append(close,save);modal.append(form,actions);back.append(modal);modalRoot.append(back);
}
async function saveSettings(){
  const save=$('.modal-actions .approve');save.disabled=true;save.textContent='Saving…';
  try {config=await api('/api/config',{ollamaUrl:$('#setOllamaUrl').value.trim(),ollamaModel:$('#setOllamaModel').value.trim(),bifrostUrl:$('#setBifrostUrl').value.trim(),bifrostModel:$('#setBifrostModel').value.trim(),bifrostKey:$('#setBifrostKey').value,inputRate:Number($('#setInputRate').value),outputRate:Number($('#setOutputRate').value)}).then(r=>r.config);modalRoot.innerHTML='';toast('Settings saved. The API key remains in server memory only.');}
  catch(err){toast(err.message);save.disabled=false;save.textContent='Save settings';}
}
async function init(){
  try {const status=await api('/api/status');config=status.config;demoRepoPath=status.demoRepo;repoInput.value=status.demoRepo;$('#repoName').textContent='nanoagent-demo';$('#repoPathShort').textContent='Sample Python repo · planted bug';updateBudget(status.session);}
  catch(err){toast('NanoAgent server is not responding. Restart it with node server.js.');}
  $('#planBtn').addEventListener('click',planTask);
  $('#useDemo').addEventListener('click',()=>{repoInput.value=demoRepoPath;$('#repoName').textContent='nanoagent-demo';$('#repoPathShort').textContent='Sample Python repo · planted bug';taskInput.value='Fix authentication so passwords containing special characters are accepted, while incorrect passwords and unknown users remain rejected.';selectedKind='fix';document.querySelectorAll('.type').forEach(b=>b.classList.toggle('active',b.dataset.kind==='fix'));taskInput.focus();});
  $('#newTask').addEventListener('click',()=>{taskInput.value='';taskInput.focus();$('#activityBody').innerHTML='<div class="empty-state"><div class="empty-icon">{ }</div><b>Ready to work in your repo</b><p>Choose a folder, describe a task, and NanoAgent<br>will map the smallest useful slice of code.</p></div>';$('#runStatus').textContent='READY';$('#activitySub').textContent='Your plan and repository scan appear here';});
  $('#editRepo').addEventListener('click',()=>repoInput.focus());
  $('#repoInput').addEventListener('change',()=>{$('#repoName').textContent=repoInput.value.split(/[\\/]/).filter(Boolean).pop()||'Choose a repository';$('#repoPathShort').textContent=repoInput.value;});
  $('#provider').addEventListener('change',()=>{if($('#confidential').checked&&$('#provider').value!=='ollama')$('#provider').value='ollama';$('#routeLabel').textContent=$('#provider').value==='ollama'?'Ollama · awaiting task':'Bifrost · awaiting task';});
  $('#confidential').addEventListener('change',()=>{if($('#confidential').checked){$('#provider').value='ollama';$('#provider').disabled=true;$('#modePill').innerHTML='<span></span> CONFIDENTIAL · LOCAL ONLY';}else{$('#provider').disabled=false;$('#modePill').innerHTML='<span></span> LOCAL APP';}});
  $('#settingsBtn').addEventListener('click',openSettings);
  $('#infoBtn').addEventListener('click',()=>toast('NanoAgent loads compact project notes, then sends only selected source excerpts to the configured model.'));
  $('#budgetEdit').addEventListener('click',async()=>{if(!window.confirm('Reset the saved session budget reservations to $0?'))return;try{const result=await api('/api/reset',{});updateBudget(result.session);toast('Session budget reset.');}catch(err){toast(err.message);}});
  $('#repoInput').addEventListener('input',()=>{$('#repoName').textContent=repoInput.value.split(/[\\/]/).filter(Boolean).pop()||'Choose a repository';$('#repoPathShort').textContent=repoInput.value||'Local files stay on this machine';});
  $('#budgetInput').addEventListener('input',()=>updateBudget({spent:Number($('#budgetUsed').textContent.replace('$',''))||0}));
  document.querySelectorAll('.type').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.type').forEach(b=>b.classList.remove('active'));button.classList.add('active');selectedKind=button.dataset.kind;}));
  taskInput.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')planTask();});
}
init();
