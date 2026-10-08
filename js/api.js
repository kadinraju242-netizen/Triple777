/* ============================================================
   Triple 7 Holdings — Trade Desk data layer
   ------------------------------------------------------------
   THE SEAM. Every read and write the Trade Desk performs goes
   through T7.api. Pages never talk to the database themselves, so
   a table or column name that changes is changed HERE only.

   Two backends, chosen at load:

     supabase — js/config.js has a project URL and anon key. Use this
                online (Vercel).
     local    — no keys. Talks to the MySQL-backed API that `node
                serve.js` runs on your computer (local-db/server.js).

   Nothing here decides who may see what. The database server does
   that (supabase/01_schema.sql online, local-db/server.js locally). A request this file makes that the
   signed-in account is not allowed simply comes back empty or
   with an error.
   ============================================================ */
window.T7 = window.T7 || {};

(function () {
  const cfg = window.T7_CONFIG || {};
  const supa = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
  /* No Supabase keys: use the MySQL-backed API run by `node serve.js`.
     Same methods, same answers; see local-db/server.js. */
  const LOCAL = !supa;
  const local = (fn, args) => {
    if (!T7.local) return Promise.reject(new Error('The local database is not available on this page.'));
    return T7.local(fn, args);
  };
  const live = supa;
  const base = live ? cfg.supabaseUrl.replace(/^(https?:\/\/[^\/]+).*$/, '$1') : '';

  /* ---------- Transports ---------- */

  /* Plain fetch with the public key, for the one thing a visitor who
     is not signed in may do: join the lot-alert list. */
  async function publicRest(path, options) {
    const opts = options || {};
    const res = await fetch(base + '/rest/v1/' + path, {
      method: opts.method || 'GET',
      headers: {
        apikey: cfg.supabaseAnonKey,
        Authorization: 'Bearer ' + cfg.supabaseAnonKey,
        'Content-Type': 'application/json'
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error('Database ' + res.status + ': ' + detail.slice(0, 200));
    }
    return res.status === 204 ? null : res.json();
  }

  /* The signed-in client from js/auth.js. */
  async function db() {
    if (!live || !T7.client) throw new Error('The database is not connected yet.');
    return T7.client();
  }

  async function userId() {
    const client = await db();
    const { data } = await client.auth.getSession();
    if (!data || !data.session) throw new Error('Please sign in first.');
    return data.session.user.id;
  }

  /* Database errors raised by our own rules are written for people
     (see the "raise exception" lines in 01_schema.sql); pass them on. */
  function unwrap(result) {
    if (result.error) {
      const msg = result.error.message || 'The request failed.';
      throw new Error(/row-level security|permission denied/i.test(msg) ? 'Your account is not allowed to do that.' : msg);
    }
    return result.data;
  }

  /* ---------- Shaping a lot for display ---------- */
  function money(value) {
    if (T7.catalog) return T7.catalog.money(value);
    const n = Math.round(Number(value) || 0);
    return 'R ' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  /* Adds the few fields the cards expect (they pre-date prices). */
  function decorate(row) {
    if (!row) return row;
    const weight = row.weight != null ? String(Number(row.weight)) + ' ' + (row.weight_unit || '') : null;
    row.descriptors = T7.catalog ? T7.catalog.summary(row) : [row.type, weight].filter(Boolean);
    row.pricing = money(row.price_zar);
    row.latest = Date.now() - new Date(row.created_at).getTime() < 7 * 86400000;
    return row;
  }

  const WITH_LOT = '*, lot:lots(id, lot_id, name, commodity, price_zar, status)';

  /* ---------- Public API ---------- */
  T7.api = {
    mode: supa ? 'supabase' : 'local',
    money: money,

    /* ----- The board ----- */

    /* Every approved lot, newest first. Members only: signed out, the
       database returns nothing. */
    async listLots() {
      if (LOCAL) return T7.local ? (await local('listLots')).map(decorate) : [];
      if (!live || !T7.client) return [];
      const client = await db();
      const rows = unwrap(await client.from('lots').select('*').eq('status', 'live').order('created_at', { ascending: false }));
      return rows.map(decorate);
    },

    /* One lot by its public id (D-3001). A seller can open their own
       lot whatever its status; everyone else only sees live lots. */
    async getLot(lotId) {
      if (LOCAL) return decorate(await local('getLot', { lot_id: lotId }));
      if (!live) return null;
      const client = await db();
      return decorate(unwrap(await client.from('lots').select('*').eq('lot_id', lotId).maybeSingle()));
    },

    /* ----- Buyers ----- */

    async sendEnquiry(lotUuid, message) {
      if (LOCAL) return local('sendEnquiry', { lot_id: lotUuid, message: message });
      const client = await db();
      return unwrap(await client.from('enquiries').insert({ lot_id: lotUuid, message: message }).select().single());
    },

    /* Enquiries this buyer has sent. `lot` is null if the lot has since
       been taken off the board. */
    async myEnquiries() {
      if (LOCAL) return local('myEnquiries');
      const client = await db();
      const id = await userId();
      return unwrap(await client.from('enquiries').select(WITH_LOT).eq('buyer_id', id).order('created_at', { ascending: false }));
    },

    /* ----- Sellers ----- */

    async myLots() {
      if (LOCAL) return (await local('myLots')).map(decorate);
      const client = await db();
      const id = await userId();
      const rows = unwrap(await client.from('lots').select('*').eq('seller_id', id).order('created_at', { ascending: false }));
      return rows.map(decorate);
    },

    /* The database forces every new lot to "pending" and to this
       seller, whatever is sent. */
    async createLot(lot) {
      if (LOCAL) return decorate(await local('createLot', lot));
      const client = await db();
      return decorate(unwrap(await client.from('lots').insert({
        commodity: lot.commodity,
        name: lot.name,
        type: lot.type || null,
        description: lot.description || null,
        price_zar: lot.price_zar,
        weight: lot.weight || null,
        weight_unit: lot.weight_unit || null,
        quantity: lot.quantity || 1,
        origin: lot.origin || null,
        specs: lot.specs || {}
      }).select().single()));
    },

    /* 'withdrawn' or 'sold'. Anything else is refused by the database. */
    async setLotStatus(lotUuid, status) {
      if (LOCAL) return decorate(await local('setLotStatus', { id: lotUuid, status: status }));
      const client = await db();
      return decorate(unwrap(await client.from('lots').update({ status: status }).eq('id', lotUuid).select().single()));
    },

    async myDocuments() {
      if (LOCAL) return local('myDocuments');
      const client = await db();
      const id = await userId();
      return unwrap(await client.from('seller_documents').select('*').eq('seller_id', id));
    },

    async sellerEnquiries() {
      if (LOCAL) return local('sellerEnquiries');
      const client = await db();
      const id = await userId();
      return unwrap(await client.from('enquiries').select(WITH_LOT).eq('seller_id', id).order('created_at', { ascending: false }));
    },

    async setEnquiryStatus(enquiryId, status) {
      if (LOCAL) return local('setEnquiryStatus', { id: enquiryId, status: status });
      const client = await db();
      return unwrap(await client.from('enquiries').update({ status: status }).eq('id', enquiryId).select().single());
    },

    /* ----- Admin -----
       Each of these only returns or changes anything for an admin
       account. For anyone else the database answers with nothing. */
    admin: {
      async load() {
        if (LOCAL) { const all = await local('adminLoad'); all.lots = all.lots.map(decorate); return all; }
        const client = await db();
        const [profiles, lots, enquiries, documents, alerts] = await Promise.all([
          client.from('profiles').select('*').order('created_at', { ascending: false }),
          client.from('lots').select('*').order('created_at', { ascending: false }),
          client.from('enquiries').select('*').order('created_at', { ascending: false }),
          client.from('seller_documents').select('*').order('created_at', { ascending: false }),
          client.from('lot_alerts').select('*').order('created_at', { ascending: false })
        ]);
        return {
          profiles: unwrap(profiles),
          lots: unwrap(lots).map(decorate),
          enquiries: unwrap(enquiries),
          documents: unwrap(documents),
          alerts: unwrap(alerts)
        };
      },

      async reviewLot(lotUuid, status, note) {
        if (LOCAL) return decorate(await local('reviewLot', { id: lotUuid, status: status, note: note }));
        const client = await db();
        return decorate(unwrap(await client.from('lots')
          .update({ status: status, review_note: note || null }).eq('id', lotUuid).select().single()));
      },

      async deleteLot(lotUuid) {
        if (LOCAL) return local('deleteLot', { id: lotUuid });
        const client = await db();
        return unwrap(await client.from('lots').delete().eq('id', lotUuid).select());
      },

      async reviewDocument(documentId, status, note) {
        if (LOCAL) return local('reviewDocument', { id: documentId, status: status, note: note });
        const client = await db();
        return unwrap(await client.from('seller_documents')
          .update({ status: status, review_note: note || null }).eq('id', documentId).select().single());
      },

      async setUserStatus(userUuid, status) {
        if (LOCAL) return local('setUserStatus', { id: userUuid, status: status });
        const client = await db();
        return unwrap(await client.rpc('admin_set_user_status', { p_user: userUuid, p_status: status }));
      },

      /* Removes the account for good, with its lots and enquiries. */
      async deleteUser(userUuid) {
        if (LOCAL) return local('deleteUser', { id: userUuid });
        const client = await db();
        return unwrap(await client.rpc('admin_delete_user', { p_user: userUuid }));
      },

      async setEnquiryStatus(enquiryId, status) {
        return T7.api.setEnquiryStatus(enquiryId, status);
      }
    },

    /* ----- Lot alerts ("tell me when new lots list") ----- */
    async subscribe(email, interests) {
      const entry = {
        email: String(email || '').trim(),
        interests: interests && interests.length ? interests : ['diamond', 'gold']
      };
      try { localStorage.setItem('t7.alerts', JSON.stringify(entry)); } catch (e) {}
      if (LOCAL) {
        try { await local('subscribe', entry); return Object.assign({}, entry, { delivered: true }); }
        catch (e) { console.error(e); return Object.assign({}, entry, { delivered: false }); }
      }
      try {
        await publicRest('rpc/subscribe_lot_alerts', { method: 'POST', body: { p_email: entry.email, p_interests: entry.interests } });
        return Object.assign({}, entry, { delivered: true });
      } catch (e) {
        console.error(e);
        return Object.assign({}, entry, { delivered: false });
      }
    },

    subscribedAs() {
      try {
        const e = JSON.parse(localStorage.getItem('t7.alerts'));
        return e && e.email ? e.email : null;
      } catch (e) { return null; }
    }
  };
})();
