/* ROI Calculator Modal Logic */
window.ROICalculator = (function() {
    const $  = (sel, root=document) => root.querySelector(sel);
    const currency = (n) => '₱'+Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2, maximumFractionDigits:2});
    const todayISO = () => new Date().toISOString().slice(0,10);

    // Helper to format days into Years, Months, Weeks, Days
    function formatDuration(totalDays) {
        if (!isFinite(totalDays) || totalDays < 0) return 'N/A';
        if (totalDays <= 1) return '1 Day';
        let days = Math.ceil(totalDays);
        const parts = [];
        const yearDays = 365;
        const monthDays = 30.44;
        const years = Math.floor(days / yearDays);
        if (years > 0) { parts.push(`${years} Year${years > 1 ? 's' : ''}`); days %= yearDays; }
        const months = Math.floor(days / monthDays);
        if (months > 0) { parts.push(`${months} Month${months > 1 ? 's' : ''}`); days %= monthDays; }
        const weeks = Math.floor(days / 7);
        if (weeks > 0) { parts.push(`${weeks} Week${weeks > 1 ? 's' : ''}`); days %= 7; }
        days = Math.round(days);
        if (days > 0) { parts.push(`${days} Day${days > 1 ? 's' : ''}`); }
        return parts.slice(0, 3).join(', ');
    }
    
    function open(pkg) {
        const totalInvestment = Number(pkg.price || 0) + Number(pkg.hosting || 0);
        const S = {
            profit: 500, count: 5, unit: 'per week', openDays: 6, start: todayISO(),
            investment: totalInvestment,
            hosting: Number(pkg.hosting || 0)
        };

        Swal.fire({
            width: 'min(900px, 90vw)',
            showCloseButton: true,
            showConfirmButton: false,
            html: `
                <div class="roi-modal-header">
                    <h2>ROI Calculator for ${pkg.name}</h2>
                    <p class="small muted">Estimate your return on investment based on your business metrics.</p>
                    <div class="chip">Total Initial Investment: <strong>${currency(S.investment)}</strong></div>
                </div>
                <div class="roi-modal-content">
                    <div class="roi-inputs">
                        <div class="form-grid">
                            <div class="form-field"><label class="small">Avg. Profit / Customer</label><input id="roi_p" class="input" type="number" value="${S.profit}"></div>
                            <div class="form-field"><label id="roi_c_label" class="small">New Customers</label><input id="roi_c" class="input" type="number" value="${S.count}"></div>
                            <div class="form-field">
                                <label class="small">Timeframe</label>
                                <select id="roi_u" class="input">
                                    <option value="per day">per Day</option>
                                    <option value="per week" selected>per Week</option>
                                    <option value="per month">per Month</option>
                                </select>
                            </div>
                            <div class="form-field">
                                <label class="small">Business Days / Week</label>
                                <select id="roi_o" class="input">${[1,2,3,4,5,6,7].map(d=>`<option value="${d}" ${d===S.openDays?'selected':''}>${d} day${d>1?'s':''}</option>`).join('')}</select>
                            </div>
                            <div class="form-field full-width"><label class="small">Start Date for Calculation</label><input id="roi_sd" class="input" value="${S.start}"></div>
                        </div>
                    </div>
                    <div class="roi-results-detailed">
                        <h4>Results Summary</h4>
                        <div class="stat-card primary-stat">
                            <div class="k">Time to Recover Investment</div>
                            <div id="res_be_time" class="v"></div>
                        </div>
                        <div class="stat-card">
                            <div class="k">Predicted Pay-off Date</div>
                            <div id="res_be_date" class="v-small"></div>
                        </div>
                        <div class="stat-card full-width">
                            <div class="k">Investment Recovery Timeline</div>
                            <div class="progress-timeline">
                                <div class="progress-item">
                                    <span id="prog_label_1"></span>
                                    <div class="progress-bar-wrap"><div id="prog_1" class="progress-bar"></div></div>
                                    <div class="progress-value"><strong id="res_1"></strong><span id="perc_1" class="progress-percent"></span></div>
                                </div>
                                <div class="progress-item">
                                    <span id="prog_label_2"></span>
                                    <div class="progress-bar-wrap"><div id="prog_2" class="progress-bar"></div></div>
                                    <div class="progress-value"><strong id="res_2"></strong><span id="perc_2" class="progress-percent"></span></div>
                                </div>
                                <div class="progress-item">
                                    <span id="prog_label_3"></span>
                                    <div class="progress-bar-wrap"><div id="prog_3" class="progress-bar"></div></div>
                                    <div class="progress-value"><strong id="res_3"></strong><span id="perc_3" class="progress-percent"></span></div>
                                </div>
                            </div>
                        </div>
                        <div class="stat-card full-width subscription-helper">
                          <i class="ri-refresh-line"></i>
                          <div>
                            <div class="k">Subscription Helper (For Year 2 onwards)
                              <span class="tip" data-tip="This is the extra amount you need to add to each customer's bill to save up for next year's annual fee, based on your estimated yearly customer count."><i class="ri-information-line info-tip"></i></span>
                            </div>
                            <div class="small muted">To cover next year's ${currency(S.hosting)} fee, you need to add this much per customer:</div>
                            <strong id="res_sub_helper" class="v-small"></strong>
                          </div>
                        </div>
                    </div>
                </div>
            `,
            customClass: { popup: 'details-modal' },
            didOpen: () => {
                const form = Swal.getHtmlContainer();
                
                // Initialize Flatpickr with the fix
                flatpickr("#roi_sd", {
                    altInput: true,
                    altFormat: "F j, Y",
                    dateFormat: "Y-m-d",
                    appendTo: document.body, // <-- NEW: This fixes the clipping issue
                });
                
                const timeframeSelect = $('#roi_u', form);
                const businessDaysSelect = $('#roi_o', form);
                const customerLabel = $('#roi_c_label', form);

                function toggleBusinessDays() { businessDaysSelect.disabled = (timeframeSelect.value === 'per day'); }
                function updateCustomerLabel() {
                    if (timeframeSelect.value === 'per day') customerLabel.textContent = 'New Customers / Day';
                    else if (timeframeSelect.value === 'per week') customerLabel.textContent = 'New Customers / Week (Total)';
                    else if (timeframeSelect.value === 'per month') customerLabel.textContent = 'New Customers / Month (Total)';
                }

                function calculateAndRender() {
                    S.profit = +$('#roi_p', form).value || 0;
                    S.count = +$('#roi_c', form).value || 0;
                    S.unit = timeframeSelect.value;
                    S.openDays = +businessDaysSelect.value || 1;
                    S.start = $('#roi_sd', form).value;
                    
                    let dailyCustomers = 0;
                    if (S.unit === 'per day') dailyCustomers = S.count;
                    else if (S.unit === 'per week') dailyCustomers = S.count / S.openDays;
                    else if (S.unit === 'per month') dailyCustomers = S.count / (4.33 * S.openDays);
                    
                    const dailyEarnings = dailyCustomers * S.profit;
                    const daysToBreakEven = (dailyEarnings > 0) ? S.investment / dailyEarnings : Infinity;
                    
                    const beDate = new Date(S.start + 'T00:00:00');
                    if(isFinite(daysToBreakEven)) { beDate.setDate(beDate.getDate() + Math.ceil(daysToBreakEven)); }

                    let p1_days, p2_days, p3_days;
                    if (daysToBreakEven < 45) {
                        p1_days = 7; p2_days = 14; p3_days = daysToBreakEven;
                        $('#prog_label_1', form).textContent = 'After 1 Week';
                        $('#prog_label_2', form).textContent = 'After 2 Weeks';
                    } else {
                        p1_days = 30.44; p2_days = daysToBreakEven / 2; p3_days = daysToBreakEven;
                        $('#prog_label_1', form).textContent = 'After 1 Month';
                        $('#prog_label_2', form).textContent = `At Midpoint (~${formatDuration(p2_days)})`;
                    }
                     $('#prog_label_3', form).textContent = `At Break-even (~${formatDuration(p3_days)})`;
                    
                    const earnings1 = dailyEarnings * p1_days;
                    const earnings2 = dailyEarnings * p2_days;
                    const earnings3 = isFinite(daysToBreakEven) ? S.investment : 0;
                    const prog1 = Math.min((earnings1 / S.investment) * 100, 100);
                    const prog2 = isFinite(daysToBreakEven) ? 50 : 0;
                    const prog3 = isFinite(daysToBreakEven) ? 100 : 0;
                    
                    const annualCustomers = dailyCustomers * S.openDays * 52;
                    const subHelperAmount = (annualCustomers > 0) ? S.hosting / annualCustomers : 0;

                    $('#res_be_time', form).textContent = formatDuration(daysToBreakEven);
                    $('#res_be_date', form).textContent = isFinite(daysToBreakEven) ? beDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric'}) : 'Not applicable';
                    $('#res_1', form).textContent = currency(earnings1);
                    $('#perc_1', form).textContent = `(${Math.round(prog1)}%)`;
                    $('#prog_1', form).style.width = `${prog1}%`;
                    $('#res_2', form).textContent = currency(earnings2);
                    $('#perc_2', form).textContent = `(${Math.round(prog2)}%)`;
                    $('#prog_2', form).style.width = `${prog2}%`;
                    $('#res_3', form).textContent = currency(earnings3);
                    $('#perc_3', form).textContent = `(${Math.round(prog3)}%)`;
                    $('#prog_3', form).style.width = `${prog3}%`;
                    $('#res_sub_helper', form).textContent = currency(subHelperAmount);
                }
                
                form.oninput = calculateAndRender;
                timeframeSelect.onchange = () => { toggleBusinessDays(); updateCustomerLabel(); calculateAndRender(); };
                
                toggleBusinessDays(); updateCustomerLabel(); calculateAndRender();
            }
        });
    }

    return { open };
})();