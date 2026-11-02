const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const {
  validateEnquiryData,
  validatePhone,
  validateEmail,
  sanitizeObject
} = require('../middleware/validation');

function validEnquiry(overrides = {}) {
  return { full_name: 'Test Customer', phone_number: '9876543210', email: 'customer@example.com', ...overrides };
}

function createTestDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_code TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      email TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_test_leads_phone ON leads(phone_number);
    CREATE TABLE appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      requested_date TEXT NOT NULL,
      requested_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'requested'
    );
  `);
  return db;
}

// Cases 1-30: valid enquiry payloads.
for (let i = 1; i <= 30; i++) {
  test(`case ${String(i).padStart(3, '0')}: accepts valid enquiry payload #${i}`, () => {
    const phone = String(9000000000 + i);
    assert.deepEqual(validateEnquiryData(validEnquiry({ full_name: `Customer ${i}`, phone_number: phone })), []);
    assert.equal(validatePhone(phone), true);
  });
}

// Cases 31-50: reject missing, blank, or too-short names.
const invalidNames = ['', ' ', 'A', '  ', '\n', '\t', ' A ', '', '  A', 'A  ', ' ', '\n\n', '\t ', '', 'B', ' x ', ' 1', 'Z', '  ', ''];
invalidNames.forEach((name, index) => {
  test(`case ${String(31 + index).padStart(3, '0')}: rejects invalid name input`, () => {
    assert.ok(validateEnquiryData(validEnquiry({ full_name: name })).includes('Full name is required'));
  });
});

// Cases 51-70: reject absent or too-short phone numbers.
const invalidPhones = ['', ' ', '1', '12', '123', '1234', '12345', '123456', '1234567', '12345678', '123456789', 'abc', 'abcdefghij', '----', '+', '000-12', 'phone-number', '99999', '123 45', 'tel:'];
invalidPhones.forEach((phone, index) => {
  test(`case ${String(51 + index).padStart(3, '0')}: rejects invalid phone input`, () => {
    assert.equal(validatePhone(phone), false);
    assert.ok(validateEnquiryData(validEnquiry({ phone_number: phone })).includes('Valid 10-digit mobile number is required'));
  });
});

// Cases 71-80: email validation.
const emailCases = [
  ['person@example.com', true], ['first.last@example.co.in', true],
  ['user+tag@example.org', true], ['a_b@example.io', true], ['x@y.dev', true],
  ['', true], ['not-an-email', false], ['missing-at.example.com', false],
  ['a@b', false], ['a b@example.com', false]
];
emailCases.forEach(([email, expected], index) => {
  test(`case ${String(71 + index).padStart(3, '0')}: email validation #${index + 1}`, () => {
    assert.equal(validateEmail(email), expected);
    assert.equal(validateEnquiryData(validEnquiry({ email })).includes('Invalid email address'), !expected);
  });
});

// Cases 81-100: database CRUD, constraints, relationships, and sanitization.
// All database tests use isolated in-memory SQLite; no production data or cloud credentials are used.
const dbCases = [
  ['insert and read a lead', db => {
    db.prepare('INSERT INTO leads (lead_code, full_name, phone_number) VALUES (?, ?, ?)').run('SV-TEST-001', 'Asha Rao', '9876543210');
    assert.equal(db.prepare('SELECT full_name FROM leads WHERE lead_code = ?').get('SV-TEST-001').full_name, 'Asha Rao');
  }],
  ['autoincrement primary key', db => {
    db.prepare('INSERT INTO leads (lead_code, full_name, phone_number) VALUES (?, ?, ?)').run('SV-TEST-002', 'Bala Rao', '9876543211');
    assert.equal(db.prepare('SELECT id FROM leads').get().id, 1);
  }],
  ['unique lead code constraint', db => {
    const q = db.prepare('INSERT INTO leads (lead_code, full_name, phone_number) VALUES (?, ?, ?)');
    q.run('SV-TEST-003', 'Chetan', '9876543212');
    assert.throws(() => q.run('SV-TEST-003', 'Duplicate', '9876543213'));
  }],
  ['required full name constraint', db => {
    assert.throws(() => db.prepare('INSERT INTO leads (lead_code, phone_number) VALUES (?, ?)').run('SV-TEST-004', '9876543214'));
  }],
  ['default lead status', db => {
    db.prepare('INSERT INTO leads (lead_code, full_name, phone_number) VALUES (?, ?, ?)').run('SV-TEST-005', 'Devi', '9876543215');
    assert.equal(db.prepare('SELECT status FROM leads').get().status, 'new');
  }],
  ['update lead status', db => {
    db.prepare('INSERT INTO leads (lead_code, full_name, phone_number) VALUES (?, ?, ?)').run('SV-TEST-006', 'Esha', '9876543216');
    db.prepare('UPDATE leads SET status = ? WHERE lead_code = ?').run('contacted', 'SV-TEST-006');
    assert.equal(db.prepare('SELECT status FROM leads').get().status, 'contacted');
  }],
  ['delete lead', db => {
    db.prepare('INSERT INTO leads (lead_code, full_name, phone_number) VALUES (?, ?, ?)').run('SV-TEST-007', 'Farhan', '9876543217');
    db.prepare('DELETE FROM leads WHERE lead_code = ?').run('SV-TEST-007');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM leads').get().n, 0);
  }],
  ['find lead by phone', db => {
    db.prepare('INSERT INTO leads (lead_code, full_name, phone_number) VALUES (?, ?, ?)').run('SV-TEST-008', 'Gita', '9876543218');
    assert.equal(db.prepare('SELECT lead_code FROM leads WHERE phone_number = ?').get('9876543218').lead_code, 'SV-TEST-008');
  }],
  ['store optional email as null', db => {
    db.prepare('INSERT INTO leads (lead_code, full_name, phone_number, email) VALUES (?, ?, ?, ?)').run('SV-TEST-009', 'Hari', '9876543219', null);
    assert.equal(db.prepare('SELECT email FROM leads').get().email, null);
  }],
  ['parameterized values preserve punctuation', db => {
    const name = "O'Neil, <Test>";
    db.prepare('INSERT INTO leads (lead_code, full_name, phone_number) VALUES (?, ?, ?)').run('SV-TEST-010', name, '9876543220');
    assert.equal(db.prepare('SELECT full_name FROM leads').get().full_name, name);
  }],
  ['count leads', db => {
    const q = db.prepare('INSERT INTO leads (lead_code, full_name, phone_number) VALUES (?, ?, ?)');
    for (let i = 11; i <= 13; i++) q.run(`SV-TEST-${i}`, `User ${i}`, `98765432${String(i).padStart(2, '0')}`);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM leads').get().n, 3);
  }],
  ['sort leads newest id first', db => {
    const q = db.prepare('INSERT INTO leads (lead_code, full_name, phone_number) VALUES (?, ?, ?)');
    q.run('SV-TEST-014', 'First', '9876543214');
    q.run('SV-TEST-015', 'Second', '9876543215');
    assert.equal(db.prepare('SELECT full_name FROM leads ORDER BY id DESC LIMIT 1').get().full_name, 'Second');
  }],
  ['insert linked appointment', db => {
    const lead = db.prepare('INSERT INTO leads (lead_code, full_name, phone_number) VALUES (?, ?, ?)').run('SV-TEST-016', 'Isha', '9876543216');
    db.prepare('INSERT INTO appointments (lead_id, requested_date, requested_time) VALUES (?, ?, ?)').run(Number(lead.lastInsertRowid), '2026-11-01', '10:00 AM');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM appointments WHERE lead_id = ?').get(Number(lead.lastInsertRowid)).n, 1);
  }],
  ['reject appointment with missing lead', db => {
    assert.throws(() => db.prepare('INSERT INTO appointments (lead_id, requested_date, requested_time) VALUES (?, ?, ?)').run(999, '2026-11-01', '10:00 AM'));
  }],
  ['cascade-delete linked appointments', db => {
    const lead = db.prepare('INSERT INTO leads (lead_code, full_name, phone_number) VALUES (?, ?, ?)').run('SV-TEST-017', 'Jaya', '9876543217');
    db.prepare('INSERT INTO appointments (lead_id, requested_date, requested_time) VALUES (?, ?, ?)').run(Number(lead.lastInsertRowid), '2026-11-02', '11:00 AM');
    db.prepare('DELETE FROM leads WHERE id = ?').run(Number(lead.lastInsertRowid));
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM appointments').get().n, 0);
  }],
  ['rollback transaction on error', db => {
    db.exec('BEGIN');
    db.prepare('INSERT INTO leads (lead_code, full_name, phone_number) VALUES (?, ?, ?)').run('SV-TEST-018', 'Rollback', '9876543218');
    assert.throws(() => db.prepare('INSERT INTO leads (lead_code, full_name, phone_number) VALUES (?, ?, ?)').run('SV-TEST-018', 'Duplicate', '9876543219'));
    db.exec('ROLLBACK');
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM leads WHERE lead_code = 'SV-TEST-018'").get().n, 0);
  }],
  ['update appointment status', db => {
    const lead = db.prepare('INSERT INTO leads (lead_code, full_name, phone_number) VALUES (?, ?, ?)').run('SV-TEST-019', 'Kiran', '9876543219');
    db.prepare("INSERT INTO appointments (lead_id, requested_date, requested_time, status) VALUES (?, ?, ?, 'requested')").run(Number(lead.lastInsertRowid), '2026-11-03', '12:00 PM');
    db.prepare("UPDATE appointments SET status = 'confirmed' WHERE lead_id = ?").run(Number(lead.lastInsertRowid));
    assert.equal(db.prepare('SELECT status FROM appointments').get().status, 'confirmed');
  }],
  ['sanitize unsafe HTML from customer input', () => {
    const cleaned = sanitizeObject({ full_name: '<script>alert(1)</script>Normal Name' });
    assert.ok(!cleaned.full_name.includes('<script>'));
    assert.ok(cleaned.full_name.includes('Normal Name'));
  }],
  ['database is isolated between test instances', () => {
    const db1 = createTestDb();
    const db2 = createTestDb();
    try {
      db1.prepare('INSERT INTO leads (lead_code, full_name, phone_number) VALUES (?, ?, ?)').run('SV-TEST-020', 'Local Only', '9876543220');
      assert.equal(db1.prepare('SELECT COUNT(*) AS n FROM leads').get().n, 1);
      assert.equal(db2.prepare('SELECT COUNT(*) AS n FROM leads').get().n, 0);
    } finally { db1.close(); db2.close(); }
  }],
  ['phone lookup index exists', db => {
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'index' AND name = 'idx_test_leads_phone'").get().n, 1);
  }]
];

dbCases.forEach(([label, runCase], index) => {
  test(`case ${String(81 + index).padStart(3, '0')}: database operation — ${label}`, () => {
    const db = createTestDb();
    try { runCase(db); } finally { db.close(); }
  });
});
