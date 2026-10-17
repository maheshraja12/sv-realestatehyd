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

    // Reset form, error alert, and success state
    const form = document.getElementById('publicEnquiryForm');
    const successBox = document.getElementById('modalSuccess');
    const errorAlert = document.getElementById('modalErrorAlert');
    if (form) form.style.display = 'block';
    if (successBox) successBox.style.display = 'none';
    if (errorAlert) errorAlert.style.display = 'none';

    backdrop.style.display = 'block';
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeEnquiryModal(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();

    const modal = document.getElementById('enquiryModal');
    const backdrop = document.getElementById('enquiryModalBackdrop');
    const errorAlert = document.getElementById('modalErrorAlert');
    if (modal) modal.style.display = 'none';
    if (backdrop) backdrop.style.display = 'none';
    if (errorAlert) errorAlert.style.display = 'none';
    document.body.style.overflow = '';

    try {
        sessionStorage.setItem('sv_enquiry_popup_dismissed', 'true');
    } catch (err) {}
}

function handleModalWrapperClick(e) {
    if (e.target.id === 'enquiryModal' || e.target.classList.contains('modal-wrapper-custom')) {
        closeEnquiryModal(e);
    }
}

function focusFirstField() {
    setTimeout(() => {
        document.getElementById('modalCustomerName')?.focus();
    }, 150);
}

// ── Form Submission Handler (4 Required Fields) ─────────────
async function handlePublicEnquirySubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = document.getElementById('modalSubmitBtn');
    if (!submitBtn) {
        alert('The enquiry form did not initialize correctly. Please refresh the page and try again.');
        return;
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
        return;
    }

    const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
    const standardPhone = cleanPhone.length === 12 && cleanPhone.startsWith('91') ? cleanPhone.slice(2) : (cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone);
    if (standardPhone.length < 10) {
        showFormError('Please enter a valid 10-digit mobile number.');
        document.getElementById('modalPhone')?.focus();
        return;
    }

    if (!appointmentDate) {
        showFormError('Please select your preferred appointment date.');
        document.getElementById('modalAppointmentDate')?.focus();
        return;
    }

    if (!appointmentTime) {
        showFormError('Please select your preferred appointment time slot.');
        document.getElementById('modalAppointmentTime')?.focus();
        return;
    }

    if (!propertyRequirement) {
        showFormError('Please select what you are looking for.');
        document.getElementById('modalPropertyRequirement')?.focus();
        return;
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
            try {
                sessionStorage.setItem('sv_enquiry_submitted', 'true');
                sessionStorage.setItem('sv_enquiry_popup_dismissed', 'true');
            } catch (err) {}
            openEnquirySuccessModal(result.lead_code || 'SV-LEAD-SUCCESS', fullName, appointmentDate, appointmentTime, propertyRequirement);
            form.reset();
        } else {
            showFormError(result.error || result.errors?.[0] || 'Submission failed. Please try again or call us.');
        }
    } catch (err) {
        showFormError('Connection error. Please call our office directly at +91-9876543210.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }

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

    backdrop.style.display = 'block';
    modal.style.display = 'flex';
    document.getElementById('publicEnquiryForm').style.display = 'none';

    const successBox = document.getElementById('modalSuccess');
    document.getElementById('successRefCode').innerText = `Reference: ${refCode}`;
    const dateText = date ? ` for <strong>${date}</strong> (${time || 'Morning'})` : '';
    document.getElementById('successMessageText').innerHTML = `Thank you, <strong>${name}</strong>. Your enquiry for <strong>${req || 'Property'}</strong>${dateText} has been logged in our system.`;

    const waLink = document.getElementById('successWhatsAppLink');
    if (waLink) {
        const waMsg = encodeURIComponent(`Hello SV Real Estates, I just submitted an enquiry for ${req || 'Property'} (Ref: ${refCode}). Preferred Date: ${date} ${time}`);
        waLink.href = `https://wa.me/919876543210?text=${waMsg}`;
    }

    successBox.style.display = 'block';
}

// ── Auto-Bind All Enquiry Buttons Across Document ───────────
function initButtonAutoBindings() {
    // Modal Close and Cancel buttons
    const closeBtn = document.getElementById('modalCloseBtn');
    if (closeBtn) {
        closeBtn.onclick = (e) => closeEnquiryModal(e);
    }
    const cancelBtn = document.getElementById('modalCancelBtn');
    if (cancelBtn) {
        cancelBtn.onclick = (e) => closeEnquiryModal(e);
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
            el.type === 'submit' || 
            el.closest('form') ||
            el.closest('.nav-links') ||
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
}

function initEscapeHandler() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeEnquiryModal(e);
        }
    });
}

// ── Auto Enquiry Popup on Website Entry ──────────────────────
function initAutoEnquiryPopup() {
    // 1. Never show on admin portal pages
    if (window.location.pathname.startsWith('/admin')) {
        return;
    }

    // 2. Do not show if user already submitted an enquiry
    try {
        if (sessionStorage.getItem('sv_enquiry_submitted')) {
            return;
        }
    } catch (e) {}

    const isHomePage = window.location.pathname === '/' || window.location.pathname === '' || window.location.pathname === '/home';

    // 3. For subpages, avoid nagging if already dismissed in this session
    try {
        if (!isHomePage && sessionStorage.getItem('sv_enquiry_popup_dismissed')) {
            return;
        }
    } catch (e) {}

    // 4. Smooth, elegant entrance after page initial paint
    setTimeout(() => {
        const modal = document.getElementById('enquiryModal');
        const backdrop = document.getElementById('enquiryModalBackdrop');
        if (modal && backdrop && modal.style.display !== 'flex') {
            openEnquiryModal();
        }
    }, 800);
}
