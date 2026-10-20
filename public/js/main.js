/**
 * SV Real Estates Hyderabad — Public Main JavaScript
 * Handles Navigation, Modals, Site Visit Scheduler, and Free Consultation popups
 */

document.addEventListener('DOMContentLoaded', () => {
    initHeaderScroll();
    initEscapeHandler();
    initButtonAutoBindings();
    initDateInputs();
    initAutoEnquiryPopup();
});

function initDateInputs() {
    const today = new Date().toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]').forEach(inp => {
        inp.min = today;
    });
}

// ── Mobile Navigation ──────────────────────────────────────
function toggleMobileNav() {
    const nav = document.getElementById('mainNav')?.querySelector('.nav-links');
    const toggle = document.getElementById('mobileNavToggle');
    if (nav) {
        nav.classList.toggle('active');
    }
}

// ── Header Scroll Glassmorphism ────────────────────────────
function initHeaderScroll() {
    const header = document.getElementById('siteHeader');
    if (!header) return;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 30) {
            header.style.boxShadow = '0 10px 30px rgba(0,0,0,0.8)';
            header.style.borderBottomColor = 'rgba(212, 175, 55, 0.3)';
        } else {
            header.style.boxShadow = 'none';
            header.style.borderBottomColor = '#272c38';
        }
    });
}

// ── Modal Mode Management (Two Options: Schedule Meet & Free Enquiry) ──
let currentModalMode = 'schedule_meet';

function setModalMode(mode) {
    currentModalMode = (mode === 'free_enquiry' || mode === 'consultation' || mode === 'enquiry') ? 'free_enquiry' : 'schedule_meet';
    const tabMeet = document.getElementById('tabScheduleMeet');
    const tabEnquiry = document.getElementById('tabFreeEnquiry');
    const submitText = document.getElementById('submitBtnText');
    const titleEl = document.getElementById('modalTitle');
    const subtitleEl = document.getElementById('modalSubtitle');
    const badgeEl = document.getElementById('modalBadge');
    const dateGroup = document.getElementById('groupVisitDate');
    const typeInput = document.getElementById('modalEnquiryType');

    if (currentModalMode === 'schedule_meet') {
        tabMeet?.classList.add('active');
        tabEnquiry?.classList.remove('active');
        if (titleEl && !titleEl.innerText.startsWith('Enquire:')) {
            titleEl.innerText = 'Schedule Meet / Site Visit';
            if (subtitleEl) subtitleEl.innerText = 'Reserve a dedicated meeting with our senior property consultant in Hyderabad.';
            if (badgeEl) badgeEl.innerText = 'ONE-ON-ONE CONSULTATION';
        }
        if (submitText) submitText.innerText = 'Confirm Schedule Meet';
        if (dateGroup) dateGroup.style.display = 'block';
        if (typeInput) typeInput.value = 'Schedule Meet';
    } else {
        tabEnquiry?.classList.add('active');
        tabMeet?.classList.remove('active');
        if (titleEl && !titleEl.innerText.startsWith('Enquire:')) {
            titleEl.innerText = 'Free Property Enquiry';
            if (subtitleEl) subtitleEl.innerText = 'Get verified property listings, price sheets, and location insights.';
            if (badgeEl) badgeEl.innerText = 'FREE ADVISORY';
        }
        if (submitText) submitText.innerText = 'Submit Free Enquiry';
        if (dateGroup) dateGroup.style.display = 'none';
        if (typeInput) typeInput.value = 'Free Enquiry';
    }
}

// ── Single Shared Enquiry Modal Controller ────────────────
function openEnquiryModal(propId = null, propTitle = '', propCode = '', propCategory = '') {
    showModalBase();
    const propIdInput = document.getElementById('modalPropertyId');
    const previewBox = document.getElementById('modalPropertyPreview');
    const titleEl = document.getElementById('modalTitle');
    const subtitleEl = document.getElementById('modalSubtitle');
    const badgeEl = document.getElementById('modalBadge');
    const reqSelect = document.getElementById('modalPropertyRequirement');
    const dateInput = document.getElementById('modalAppointmentDate');

    // Set today as min date for appointment picker
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.min = today;
        if (!dateInput.value) {
            dateInput.value = today;
        }
    }

    if (propId) {
        if (propIdInput) propIdInput.value = propId;
        const titleTarget = document.getElementById('modalPropTitle');
        const codeTarget = document.getElementById('modalPropCode');
        if (titleTarget) titleTarget.innerText = propTitle;
        if (codeTarget) codeTarget.innerText = propCode ? `Ref: ${propCode}` : '';
        if (previewBox) previewBox.style.display = 'flex';
        if (titleEl) titleEl.innerText = `Enquire: ${propTitle}`;
        if (subtitleEl) subtitleEl.innerText = 'Schedule a site walkthrough or meeting with our senior property advisor.';
        if (badgeEl) badgeEl.innerText = 'PROPERTY ENQUIRY';

        // Auto-select property requirement if known
        if (reqSelect && propCategory) {
            const cat = propCategory.toLowerCase();
            if (cat.includes('villa')) reqSelect.value = 'Villa';
            else if (cat.includes('plot')) reqSelect.value = 'Residential Plot';
            else if (cat.includes('apartment')) reqSelect.value = 'Apartment';
            else if (cat.includes('commercial')) reqSelect.value = 'Commercial Property';
            else reqSelect.value = 'Other';
        }
    } else {
        if (propIdInput) propIdInput.value = '';
        if (previewBox) previewBox.style.display = 'none';
        if (titleEl) titleEl.innerText = 'Enquire & Schedule Visit';
        if (subtitleEl) subtitleEl.innerText = 'Connect directly with our senior property consultant in Hyderabad.';
        if (badgeEl) badgeEl.innerText = 'DIRECT ENQUIRY';
    }

    focusFirstField();
}

function openScheduleVisitModal(propId = null, propTitle = '', propCode = '') {
    openEnquiryModal(propId, propTitle, propCode);
}

function openConsultationModal(context = '') {
    openEnquiryModal();
}

function showModalBase() {
    const modal = document.getElementById('enquiryModal');
    const backdrop = document.getElementById('enquiryModalBackdrop');
    if (!modal || !backdrop) return;

    // Reset form, error alert, and restore form + header visibility
    const form = document.getElementById('publicEnquiryForm');
    const header = document.querySelector('.modal-header-custom');
    const successBox = document.getElementById('modalSuccess');
    const errorAlert = document.getElementById('modalErrorAlert');

    if (form) form.style.display = 'block';
    if (header) header.style.display = 'block';
    if (successBox) successBox.style.display = 'none';
    if (errorAlert) errorAlert.style.display = 'none';

    backdrop.style.display = 'block';
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeEnquiryModal(e) {
    if (e) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }

    const modal = document.getElementById('enquiryModal');
    const backdrop = document.getElementById('enquiryModalBackdrop');
    const errorAlert = document.getElementById('modalErrorAlert');
    if (modal) modal.style.display = 'none';
    if (backdrop) backdrop.style.display = 'none';
    if (errorAlert) errorAlert.style.display = 'none';
    document.body.style.overflow = '';

    // Clean any query string left in URL (e.g. ?property_id=&full_name=...)
    try {
        if (window.location.search) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    } catch (err) {}
}

function handleModalWrapperClick(e) {
    if (e.target.id === 'enquiryModal' || e.target.classList.contains('modal-wrapper-custom')) {
        closeEnquiryModal(e);
    }
}

function focusFirstField() {
    if (window.innerWidth > 768) {
        setTimeout(() => {
            document.getElementById('modalCustomerName')?.focus();
        }, 150);
    }
}

// ── Form Submission Handler (4 Required Fields) ─────────────
async function handlePublicEnquirySubmit(e) {
    if (e) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    }

    const form = document.getElementById('publicEnquiryForm') || (e ? e.target : null);
    const submitBtn = document.getElementById('modalSubmitBtn');
    if (!submitBtn) {
        alert('The enquiry form did not initialize correctly. Please refresh the page and try again.');
        return false;
    }
    const originalText = submitBtn.innerHTML;
    const errorAlert = document.getElementById('modalErrorAlert');
    const errorText = document.getElementById('modalErrorText');

    if (errorAlert) errorAlert.style.display = 'none';

    // 1. Full Name
    const fullName = (document.getElementById('modalCustomerName')?.value || '').trim();
    // 2. Phone Number
    const rawPhone = (document.getElementById('modalPhone')?.value || '').trim();
    // 3. Appointment Date & Time
    const appointmentDate = (document.getElementById('modalAppointmentDate')?.value || '').trim();
    const appointmentTime = (document.getElementById('modalAppointmentTime')?.value || '').trim();
    // 4. Property Requirement
    const propertyRequirement = (document.getElementById('modalPropertyRequirement')?.value || '').trim();
    const propId = document.getElementById('modalPropertyId')?.value || null;

    if (!fullName || fullName.length < 2) {
        showFormError('Please enter your full name (minimum 2 characters).');
        document.getElementById('modalCustomerName')?.focus();
        return false;
    }

    const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
    const standardPhone = cleanPhone.length === 12 && cleanPhone.startsWith('91') ? cleanPhone.slice(2) : (cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone);
    if (standardPhone.length < 10) {
        showFormError('Please enter a valid 10-digit mobile number.');
        document.getElementById('modalPhone')?.focus();
        return false;
    }

    if (!appointmentDate) {
        showFormError('Please select your preferred appointment date.');
        document.getElementById('modalAppointmentDate')?.focus();
        return false;
    }

    if (!appointmentTime) {
        showFormError('Please select your preferred appointment time slot.');
        document.getElementById('modalAppointmentTime')?.focus();
        return false;
    }

    if (!propertyRequirement) {
        showFormError('Please select what you are looking for.');
        document.getElementById('modalPropertyRequirement')?.focus();
        return false;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting Enquiry...';

    const payload = {
        full_name: fullName,
        customer_name: fullName,
        phone_number: standardPhone,
        phone: standardPhone,
        appointment_date: appointmentDate,
        preferred_visit_date: appointmentDate,
        appointment_time: appointmentTime,
        property_requirement: propertyRequirement,
        property_category: propertyRequirement,
        property_id: propId ? parseInt(propId) : null,
        consent: 1,
        source: 'website'
    };

    try {
        const res = await fetch('/api/leads/public', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const responseText = await res.text();
        let result = {};
        try {
            result = responseText ? JSON.parse(responseText) : {};
        } catch (parseError) {
            result = { error: `The server returned an unexpected response (HTTP ${res.status}). Please refresh and try again.` };
        }

        if (res.ok) {
            // Permanently remember submission in both localStorage and sessionStorage
            try {
                localStorage.setItem('sv_enquiry_submitted', 'true');
                sessionStorage.setItem('sv_enquiry_submitted', 'true');
                localStorage.setItem('sv_enquiry_popup_dismissed', 'true');
                sessionStorage.setItem('sv_enquiry_popup_dismissed', 'true');
            } catch (err) {}

            // Clean query parameters from URL immediately
            try {
                if (window.location.search) {
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            } catch (err) {}

            openEnquirySuccessModal(result.lead_code || result.reference || 'SV-LEAD-SUCCESS', fullName, appointmentDate, appointmentTime, propertyRequirement);
            if (form) form.reset();
        } else {
            showFormError(result.error || result.errors?.[0] || 'Submission failed. Please try again or call us.');
        }
    } catch (err) {
        showFormError('Connection error. Please call our office directly at +91 9346423434.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }

    return false;

    function showFormError(msg) {
        if (errorAlert && errorText) {
            errorText.innerText = msg;
            errorAlert.style.display = 'block';
        } else {
            alert(msg);
        }
    }
}

function openEnquirySuccessModal(refCode, name, date, time, req) {
    const modal = document.getElementById('enquiryModal');
    const backdrop = document.getElementById('enquiryModalBackdrop');
    if (!modal || !backdrop) return;

    // Clean query parameters and prepare success card view

    // Clean query parameters from URL immediately
    try {
        if (window.location.search) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    } catch (err) {}

    backdrop.style.display = 'block';
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Hide input form and header
    const form = document.getElementById('publicEnquiryForm');
    if (form) form.style.display = 'none';
    const header = document.querySelector('.modal-header-custom');
    if (header) header.style.display = 'none';
    const preview = document.getElementById('modalPropertyPreview');
    if (preview) preview.style.display = 'none';

    // Populate Luxury Greeting Card
    const nameTarget = document.getElementById('greetingCustomerName');
    if (nameTarget) nameTarget.innerText = name || 'Valued Client';

    const refTarget = document.getElementById('successRefCode');
    if (refTarget) refTarget.innerText = refCode;

    const dateSlotTarget = document.getElementById('greetingDateSlot');
    if (dateSlotTarget) {
        dateSlotTarget.innerText = date ? `${date} • ${time || 'Morning'}` : 'Priority Callback';
    }

    const reqTarget = document.getElementById('greetingRequirement');
    if (reqTarget) {
        reqTarget.innerText = req || 'Hyderabad Property';
    }

    const msgTarget = document.getElementById('successMessageText');
    if (msgTarget) {
        const slotDesc = date ? ` for <strong>${date}</strong> (${time || 'Morning'})` : '';
        msgTarget.innerHTML = `Your consultation request${slotDesc} has been confirmed. Our senior advisor will assist you with verified documentation and transparent pricing.`;
    }

    // Direct WhatsApp Button with valid business number
    const waLink = document.getElementById('successWhatsAppLink');
    if (waLink) {
        const waMsg = encodeURIComponent(`Hello SV Real Estates, I just submitted an enquiry for ${req || 'Property'} (Ref: ${refCode}). Preferred Date: ${date || 'Today'} ${time || ''}`);
        waLink.href = `https://wa.me/919346423434?text=${waMsg}`;
    }

    const successBox = document.getElementById('modalSuccess');
    if (successBox) successBox.style.display = 'block';
}

function copyReferenceCode() {
    const codeEl = document.getElementById('successRefCode');
    const labelEl = document.getElementById('copyBtnLabel');
    if (!codeEl) return;
    const text = codeEl.innerText.replace(/Reference:\s*/i, '').trim();
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            if (labelEl) labelEl.innerText = 'Copied!';
            setTimeout(() => { if (labelEl) labelEl.innerText = 'Copy'; }, 2000);
        }).catch(() => {});
    }
}

// ── Auto-Bind All Enquiry Buttons Across Document ───────────
function initButtonAutoBindings() {
    // Explicitly bind the enquiry form submit event to prevent default reload
    const enquiryForm = document.getElementById('publicEnquiryForm');
    if (enquiryForm) {
        enquiryForm.onsubmit = function(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            handlePublicEnquirySubmit(ev);
            return false;
        };
        enquiryForm.addEventListener('submit', function(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            handlePublicEnquirySubmit(ev);
            return false;
        }, { capture: true });
    }

    // Modal Close, Cancel, and Done / Back to Main Page buttons
    const closeBtn = document.getElementById('modalCloseBtn');
    if (closeBtn) {
        closeBtn.onclick = (e) => closeEnquiryModal(e);
    }
    const cancelBtn = document.getElementById('modalCancelBtn');
    if (cancelBtn) {
        cancelBtn.onclick = (e) => closeEnquiryModal(e);
    }
    const backToMainBtn = document.getElementById('modalBackToMainBtn');
    if (backToMainBtn) {
        backToMainBtn.onclick = (e) => closeEnquiryModal(e);
    }

    // 1. Header CTA button
    const headerCta = document.querySelector('.btn-header-cta');
    if (headerCta) {
        headerCta.onclick = (e) => {
            e.preventDefault();
            openEnquiryModal();
        };
    }

    // 2. Any button or link with enquiry / consultation / visit intent
    document.querySelectorAll('button, a').forEach(el => {
        if (el.classList.contains('modal-close-btn') || 
            el.id === 'modalCancelBtn' ||
            el.classList.contains('btn-cancel-custom') ||
            el.classList.contains('btn-card-enquire') ||
            el.type === 'submit' || 
            el.closest('form') ||
            el.closest('.nav-links') ||
            el.closest('.modal-success-state') ||
            el.classList.contains('btn-whatsapp') ||
            el.href?.startsWith('tel:') ||
            el.href?.startsWith('mailto:') ||
            el.href?.startsWith('https://wa.me')) {
            return;
        }

        const text = el.innerText?.trim().toLowerCase() || '';
        if (
            text.includes('enquire') || 
            text.includes('consultation') || 
            text.includes('consultant') ||
            text.includes('schedule meet') || 
            text.includes('schedule visit') || 
            text.includes('site visit') ||
            text.includes('book visit') ||
            text.includes('free advisory')
        ) {
            el.onclick = (e) => {
                e.preventDefault();
                openEnquiryModal();
            };
        }
    });

    // 3. Dedicated handler for Property Card Enquire Now buttons
    document.querySelectorAll('.btn-card-enquire').forEach(btn => {
        btn.onclick = function(e) {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            const id = this.dataset.propId || this.getAttribute('data-prop-id') || null;
            const title = this.dataset.propTitle || this.getAttribute('data-prop-title') || '';
            const code = this.dataset.propCode || this.getAttribute('data-prop-code') || '';
            const cat = this.dataset.propCategory || this.getAttribute('data-prop-category') || '';
            openEnquiryModal(id, title, code, cat);
            return false;
        };
    });
}

// Global click delegation for property card Enquire Now buttons
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-card-enquire');
    if (btn) {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.dataset.propId || btn.getAttribute('data-prop-id') || null;
        const title = btn.dataset.propTitle || btn.getAttribute('data-prop-title') || '';
        const code = btn.dataset.propCode || btn.getAttribute('data-prop-code') || '';
        const cat = btn.dataset.propCategory || btn.getAttribute('data-prop-category') || '';
        openEnquiryModal(id, title, code, cat);
    }
});

function initEscapeHandler() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeEnquiryModal(e);
        }
    });
}

// ── Auto Enquiry Popup on Website Entry ──────────────────────
function initAutoEnquiryPopup() {
    // 1. Only show on the Home page (when anyone opens the homepage)
    const rawPath = window.location.pathname || '';
    const cleanPath = rawPath.replace(/\/+$/, '') || '/';
    const isHomePage = cleanPath === '/' || cleanPath === '/index.html' || cleanPath === '';
    
    if (!isHomePage) {
        return;
    }

    // 2. Clear any legacy dismissal flags so the popup is never blocked on the homepage
    try {
        localStorage.removeItem('sv_enquiry_popup_dismissed');
        sessionStorage.removeItem('sv_enquiry_popup_dismissed');
        localStorage.removeItem('sv_enquiry_submitted');
    } catch (e) {}

    // 3. Promptly pop up enquiry page first when opening the homepage
    setTimeout(() => {
        const modal = document.getElementById('enquiryModal');
        const backdrop = document.getElementById('enquiryModalBackdrop');
        if (modal && backdrop && modal.style.display !== 'flex') {
            openEnquiryModal();
        }
    }, 400);
}
