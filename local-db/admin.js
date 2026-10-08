/* ============================================================
   Triple 7 Holdings — database tools for the terminal
   ------------------------------------------------------------
   Admins are made here, never from the website. MySQL must be
   running. The server can stay running while you use these.

     node local-db/admin.js list
     node local-db/admin.js make-admin   someone@example.com
     node local-db/admin.js remove-admin someone@example.com
     node local-db/admin.js password     someone@example.com NewPassword123
     node local-db/admin.js delete-user  someone@example.com
     node local-db/admin.js reset        (wipe everything, reload the test data)

   For make-admin the account must already exist: create it on the
   site first. You can do all of this in phpMyAdmin too — an admin is
   simply a row in `profiles` whose `role` is 'admin'.
   ============================================================ */
const store = require('./server.js');

const [cmd, emailArg, extra] = process.argv.slice(2);
const email = String(emailArg || '').trim().toLowerCase();

async function account() {
  const p = await store.one('SELECT id, email, role FROM profiles WHERE email = ?', [email]);
  if (!p) throw new Error('No account with the email "' + (emailArg || '') + '". Create it on the site first.');
  return p;
}

async function main() {
  await store.init();

  if (cmd === 'list') {
    const rows = await store.q('SELECT role, status, email FROM profiles ORDER BY role, email');
    rows.forEach(p => console.log(String(p.role || '(none)').padEnd(7), p.status.padEnd(10), p.email));
  } else if (cmd === 'make-admin') {
    const p = await account();
    await store.q("UPDATE profiles SET role = 'admin', status = 'active', verified = 1 WHERE id = ?", [p.id]);
    console.log(p.email + ' is now an admin. Sign out and in again on the site.');
  } else if (cmd === 'remove-admin') {
    const p = await account();
    await store.q("UPDATE profiles SET role = 'buyer' WHERE id = ?", [p.id]);
    console.log(p.email + ' is no longer an admin (now a buyer).');
  } else if (cmd === 'password') {
    if (!extra || extra.length < 8) throw new Error('Give a new password of at least 8 characters.');
    const p = await account();
    await store.q('UPDATE profiles SET password_hash = ? WHERE id = ?', [store.hashPassword(extra), p.id]);
    await store.q('DELETE FROM sessions WHERE user_id = ?', [p.id]);
    console.log('Password changed for ' + p.email + '.');
  } else if (cmd === 'delete-user') {
    const p = await account();
    await store.q('DELETE FROM profiles WHERE id = ?', [p.id]);
    console.log(p.email + ' deleted, with their lots, documents and enquiries.');
  } else if (cmd === 'reset') {
    await store.q('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of ['sessions', 'enquiries', 'seller_documents', 'lots', 'lot_alerts', 'profiles']) await store.q('DROP TABLE IF EXISTS ' + t);
    await store.q('SET FOREIGN_KEY_CHECKS = 1');
    await store.end();
    console.log('Tables dropped. Start the site again (node serve.js) and the test data is reloaded.');
    return;
  } else {
    console.log('Commands: list | make-admin <email> | remove-admin <email> | password <email> <new password> | delete-user <email> | reset');
  }
  await store.end();
}

main().catch(e => { console.error(e.code ? store.explain(e) : e.message); process.exit(1); });
