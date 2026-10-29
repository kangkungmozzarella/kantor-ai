// Each workspace's team: who sits in the office, their division and hair, and which of them run an AI agent.
// The office has four desk groups of four, 14 dining seats and enough rooftop spots for 14, hence the limits.
const DIVISIONS = {leadership: 'Leadership', marketing: 'Marketing & Business', engineering: 'Engineering & Design', service: 'Customer Service'};
const MAX_MEMBERS = 14, PER_DIVISION = 4;
const MODELS = {
  'claude-sonnet-5-5': 'Sonnet 5.5 · balanced',
  'claude-haiku-5-5': 'Haiku 5.5 · fast, lowest cost',
  'claude-opus-5-5': 'Opus 5.5 · strongest, highest cost',
  'claude-haiku-4-5-20251001': 'Haiku 4.5 · fast, low cost'
};

// Shared rule: ask instead of guessing. The server turns an answer that starts with QUESTIONS: into a
// "Needs decision" task that waits for a person to answer.
const ASK = [
  'If the brief is missing information you cannot draft well without (for example the product, the audience or the key facts),',
  'do not guess: reply with the line QUESTIONS: followed by at most three short numbered questions, and nothing else.',
  'Otherwise never start your answer with QUESTIONS:.'
].join(' ');
// What each kind of agent does. A workspace can add its own instructions on top, or write them all (custom).
const PRESETS = {
  social: {label: 'Social media drafts', rules: [
    'You receive tasks from teammates and return drafts that a human will review before anything is published.',
    'Write in the language of the task (Indonesian or English). If the task mixes both, follow the brief.',
    'Structure your answer as: a short summary line, then two or three caption options with suggested hashtags, then any notes or questions for the reviewer.',
    'Never claim that you posted, scheduled or sent anything. Never invent facts about the company, products, prices or people; if something is missing, list it under notes as a question.',
    'Keep the whole answer under 600 words.'
  ]},
  service: {label: 'Customer service replies', rules: [
    'You draft replies to customer messages. A human reviews every reply before it is sent.',
    'Reply in the customer\'s language. Be warm, short and concrete: acknowledge the issue, give the next step, and close politely.',
    'Never promise refunds, discounts, delivery dates or anything else the brief does not confirm. Never claim that you sent the reply.',
    'Structure your answer as: the reply draft, then a short note for the reviewer if anything should be checked.',
    'Keep the whole answer under 250 words.'
  ]},
  custom: {label: 'Custom instructions', rules: [
    'You receive tasks from teammates and return drafts that a human reviews before anything is used.',
    'Write in the language of the task (Indonesian or English).',
    'Never claim that you sent, posted, published or changed anything outside this draft. Never invent facts about the company, products, prices or people; list missing facts as questions for the reviewer.',
    'Keep the whole answer under 800 words.'
  ]}
};

const member = (name, initials, role, division, look, agent = null) => ({name, initials, role, division, look, agent});
const DEFAULT_TEAM = [
  member('Koh Arman', 'KA', 'CEO', 'leadership', 'short'),
  member('Koh Wira', 'KW', 'CTO', 'leadership', 'short'),
  member('Kak Rani', 'KR', 'Social Media Specialist', 'marketing', 'long', {preset: 'social', model: 'claude-sonnet-5-5', instructions: ''}),
  member('Kak Dewi', 'KD', 'Digital Marketing', 'marketing', 'long'),
  member('Mira', 'M', 'Business Development', 'marketing', 'long'),
  member('Tari', 'T', 'Social Media Intern', 'marketing', 'long'),
  member('Bagas Pratama Putra', 'BPP', 'Frontend Engineer', 'engineering', 'short'),
  member('Rizky Hakim', 'RH', 'Backend Engineer', 'engineering', 'short'),
  member('Yoga', 'Y', 'Product Design', 'engineering', 'short'),
  member('Bang Eko', 'BE', 'Graphic Designer', 'engineering', 'short'),
  member('Gilang', 'G', 'Customer Service Leader', 'service', 'short'),
  member('Kak Sinta', 'KS', 'Customer Service', 'service', 'long', {preset: 'service', model: 'claude-haiku-4-5-20251001', instructions: ''}),
  member('Kak Laras', 'KL', 'Customer Service', 'service', 'long')
];

function systemFor(person, team) {
  const preset = PRESETS[person.agent.preset];
  return [
    `You are the ${person.role} on a ${team.length}-person team working in a virtual office called Kantor Kita.`,
    ...preset.rules,
    ...(person.agent.instructions ? [`Instructions from your workspace:\n${person.agent.instructions}`] : []),
    ASK
  ].join('\n');
}
// The connected members of a team, as the worker uses them: name → {role, preset, model, system}.
const agentsOf = team => Object.fromEntries(team.filter(p => p.agent).map(p => [p.name, {role: p.role, preset: p.agent.preset, model: p.agent.model, system: systemFor(p, team)}]));

const fail = message => { throw Object.assign(new Error(message), {status: 400}); };
const clean = (value, max) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
// Checks a team sent by the editor. Each person may carry `previous`, their name before this edit,
// so tasks follow a renamed person instead of being left without an assignee.
function validate(input, current) {
  if (!Array.isArray(input) || !input.length) fail('Keep at least one person on the team.');
  if (input.length > MAX_MEMBERS) fail(`The office has room for ${MAX_MEMBERS} people.`);
  const names = new Set(), initials = new Set(), counts = {}, renames = {}, previous = new Set(current.map(p => p.name));
  const team = input.map((raw, i) => {
    const row = `Person ${i + 1}`, name = clean(raw?.name, 40), short = clean(raw?.initials, 4).toUpperCase(), role = clean(raw?.role, 60);
    if (!name) fail(`${row}: enter a name.`);
    if (names.has(name.toLowerCase())) fail(`${name} appears twice. Use a different name.`); names.add(name.toLowerCase());
    if (!/^[A-Z0-9]{1,4}$/.test(short)) fail(`${name}: initials are 1–4 letters or digits.`);
    if (initials.has(short)) fail(`Initials ${short} are used twice.`); initials.add(short);
    if (!role) fail(`${name}: enter a role.`);
    if (!Object.hasOwn(DIVISIONS, raw?.division)) fail(`${name}: pick a division.`);
    if ((counts[raw.division] = (counts[raw.division] || 0) + 1) > PER_DIVISION) fail(`${DIVISIONS[raw.division]} has ${PER_DIVISION} desks. Move someone to another division.`);
    if (!['long', 'short'].includes(raw?.look)) fail(`${name}: pick a hair style.`);
    let agent = null;
    if (raw?.agent) {
      const preset = raw.agent.preset, model = raw.agent.model, instructions = typeof raw.agent.instructions === 'string' ? raw.agent.instructions.trim().slice(0, 2000) : '';
      if (!Object.hasOwn(PRESETS, preset)) fail(`${name}: pick what the AI agent does.`);
      if (!Object.hasOwn(MODELS, model)) fail(`${name}: pick a Claude model.`);
      if (preset === 'custom' && !instructions) fail(`${name}: write the instructions for a custom agent.`);
      agent = {preset, model, instructions};
    }
    const before = clean(raw?.previous, 40);
    if (before && previous.has(before) && before !== name) { if (Object.hasOwn(renames, before)) fail(`${before} was renamed twice.`); renames[before] = name; }
    return {name, initials: short, role, division: raw.division, look: raw.look, agent};
  });
  return {team, renames};
}

module.exports = {DIVISIONS, MAX_MEMBERS, PER_DIVISION, MODELS, PRESETS: Object.fromEntries(Object.entries(PRESETS).map(([k, p]) => [k, p.label])), DEFAULT_TEAM, agentsOf, validate};
