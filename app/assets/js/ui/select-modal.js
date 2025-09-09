/* Select Modal — collects contact info, sends email via Apps Script, then auto-approves in Firestore */
window.SelectModal = (function () {
  const $ = (s, r = document) => r.querySelector(s);
  const currency =
    window.currency ||
    ((n) =>
      "₱" +
      Number(n || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }));

  // Helper function for phone formatting
  function formatPhoneNumber(value) {
    const cleaned = ('' + value).replace(/\D/g, '');
    const limited = cleaned.substring(0, 11);
    const match = limited.match(/^(\d{0,4})(\d{0,3})(\d{0,4})$/);
    if (!match) return limited;
    return [match[1], match[2], match[3]].filter(part => part).join(' ');
  }

  function totalFor(pkg, cfg) {
    const hosting = Number(pkg.hosting || 0);
    const price = Number(pkg.price || 0);
    const total = price + hosting;
    const dpPct = Number(cfg?.proposal?.downpaymentPercent || 50);
    return { total, dpPct, dpAmt: total * (dpPct / 100) };
  }

  function htmlForm(pkg, cfg) {
    const msg = `Hello Modern Cipher,\n\nI would like to proceed with the ${pkg.name} package.\n\nAdditional notes:`;
    return `
      <div class="select-form-grid">
        <div>
          <label class="small">Prefix</label>
          <select id="sel_prefix" class="input">
            <option>Mr.</option><option>Ms.</option><option>Mrs.</option>
            <option>Dr.</option><option>Engr.</option><option>Atty.</option>
          </select>
        </div>
        <div><label class="small">First Name</label><input id="sel_fname" class="input" placeholder="Juan" required></div>
        <div><label class="small">Last Name</label><input id="sel_lname" class="input" placeholder="Dela Cruz" required></div>
        <div>
          <label class="small">Email</label>
          <input id="sel_email" class="input" type="email" placeholder="you@email.com" required 
                 pattern="^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$" 
                 title="Please enter a valid email address.">
        </div>

        <div>
          <label class="small">Contact Number</label>
          <input id="sel_phone" class="input" type="tel" placeholder="0917 123 4567" 
                 inputmode="numeric" 
                 oninput="this.value = window.SelectModal.formatPhoneNumber(this.value)"
                 title="Please enter a valid 11-digit PH mobile number.">
        </div>

        <div class="full-width">
          <label class="small">Message</label>
          <textarea id="sel_msg" class="input" rows="4">${msg}</textarea>
        </div>
        <div class="full-width small muted" style="margin-top:6px">
          <i class="ri-information-line"></i>
          Your selected package: <strong>${
            pkg.name
          }</strong> — One-time ${currency(pkg.price)} + ${currency(
      pkg.hosting || 0
    )} / ${pkg.cadence || "year"}.
        </div>
      </div>`;
  }

  async function sendAppsScript(payload) {
    const url = window.APPS_SCRIPT_URL;
    if (!url) { throw new Error("APPS_SCRIPT_URL is not defined."); }
    fetch(url, {
      method: 'POST', mode: 'cors', body: JSON.stringify(payload)
    }).catch(error => {
      console.warn("CORS error is expected. Ignoring fetch error:", error);
    });
    return Promise.resolve({ result: 'success' });
  }

  // FIX: This function now updates the existing client record instead of creating a new one.
  async function saveApprovedToFirestore({ cfgId, client, pkg, totals }) {
    try {
        const existingClient = await Store.getClientByConfigId(cfgId);
        if (!existingClient) {
            console.error("CRITICAL: Could not find client record for configId:", cfgId);
            Swal.fire('Error', 'Could not find the original proposal record. Please contact support.', 'error');
            return;
        }

        // Get existing selections or initialize a new object
        const selections = existingClient.selections || {};

        // Add the newly selected package to the selections object
        selections[pkg.name] = {
            amount: totals.total,
            selectedAt: new Date().toISOString()
        };

        // Prepare the data to update the client record
        const patchData = {
            name: `${client.prefix} ${client.firstName} ${client.lastName}`.trim(),
            email: client.email,
            phone: client.phone,
            selections: selections // Save the updated selections object
        };

        await Store.updateClient(existingClient.id, patchData);

    } catch (e) {
        console.warn("Skipping Firestore save (not critical):", e);
        Swal.fire('Error', 'An error occurred while saving your selection. Please try again.', 'error');
    }
  }

  async function open(pkg, cfg, cfgId) {
    const totals = totalFor(pkg, cfg);
    Swal.fire({
      title: `Proceed with ${pkg.name}`,
      html: htmlForm(pkg, cfg),
      showCancelButton: true,
      confirmButtonText: '<i class="ri-send-plane-2-line"></i> Send & Approve',
      customClass: { popup: "select-modal" },
      preConfirm: async () => {
        const v = {
          prefix: $("#sel_prefix").value,
          firstName: $("#sel_fname").value.trim(),
          lastName: $("#sel_lname").value.trim(),
          email: $("#sel_email").value.trim(),
          phone: $("#sel_phone").value.trim(),
          message: $("#sel_msg").value.trim(),
        };

        const cleanedPhone = v.phone.replace(/\s/g, '');
        const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
        const phoneRegex = /^09\d{9}$/;
        let errors = [];

        if (!v.firstName || !v.lastName) {
          errors.push("First name and Last name are required.");
        }
        if (!v.email || !emailRegex.test(v.email)) {
          errors.push("Please provide a valid email address.");
        }
        if (v.phone && (cleanedPhone.length !== 11 || !phoneRegex.test(cleanedPhone))) {
          errors.push("Please use a valid 11-digit PH mobile number (e.g., 09171234567).");
        }

        if (errors.length > 0) {
          Swal.showValidationMessage(errors.join('<br>'));
          return false;
        }
        return v;
      },
    }).then(async (res) => {
      if (!res.isConfirmed) return;
      const client = res.value;
      const link = Store.linkFor(cfgId);
      const payload = {
        type: "proposal_select", datetime: new Date().toISOString(), proposalLink: link, configId: cfgId,
        package: {
          key: pkg.key, name: pkg.name, price: pkg.price,
          hosting: pkg.hosting || 0, cadence: pkg.cadence || "year",
        },
        totals: {
          total: totals.total, dpPercent: totals.dpPct, downpayment: totals.dpAmt,
        },
        client,
      };
      
      sendAppsScript(payload);
      await saveApprovedToFirestore({ cfgId, client, pkg, totals });

      Swal.fire({
        icon: "success", title: "Sent! Please check your email",
        html: `
          <div class="small" style="text-align:left">
            <p>We've sent your selection and details. Next steps:</p>
            <ol style="margin-left:18px">
              <li>Wait for our confirmation & digital proposal copy.</li>
              <li>You'll receive the initial invoice and payment instructions.</li>
              <li>After confirmation, we'll send the project timeline link.</li>
            </ol>
          </div>`,
        confirmButtonText: "Got it",
        customClass: { popup: "select-modal" },
      });
    });
  }

  return { open, formatPhoneNumber };
})();