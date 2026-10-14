/**
 * SV Real Estates Hyderabad — Property Form Dynamic Behaviors & Uploads
 */

let pendingUploadFiles = [];

document.addEventListener('DOMContentLoaded', () => {
    toggleCategoryFields();
    initUploadZone();
});

function toggleCategoryFields() {
    const category = document.getElementById('category')?.value;
    const plotFields = document.getElementById('plotFields');
    const villaFields = document.getElementById('villaFields');

    if (plotFields) {
        if (category === 'residential_plot' || category === 'agricultural_land') {
            plotFields.style.display = 'block';
        } else {
            plotFields.style.display = 'none';
        }
    }

    if (villaFields) {
        if (category === 'villa' || category === 'independent_house') {
            villaFields.style.display = 'block';
        } else {
            villaFields.style.display = 'none';
        }
    }
}

function initUploadZone() {
    const zone = document.getElementById('uploadZone');
    const input = document.getElementById('imageInput');
    if (!zone || !input) return;

    zone.addEventListener('click', (e) => {
        if (e.target !== input) input.click();
    });

    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.style.borderColor = '#d4af37';
        zone.style.backgroundColor = '#20242e';
    });

    zone.addEventListener('dragleave', () => {
        zone.style.borderColor = '';
        zone.style.backgroundColor = '';
    });

    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.style.borderColor = '';
        zone.style.backgroundColor = '';
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleSelectedFiles(e.dataTransfer.files);
        }
    });

    input.addEventListener('change', () => {
        if (input.files && input.files.length > 0) {
            handleSelectedFiles(input.files);
        }
    });
}

async function handleSelectedFiles(files) {
    const propertyId = document.getElementById('propertyId')?.value;

    if (propertyId) {
        // Direct upload to existing property
        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            formData.append('images', files[i]);
        }

        showToast('Uploading images...');
        try {
            const res = await fetch(`/api/properties/${propertyId}/images`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                showToast('Images uploaded successfully');
                setTimeout(() => location.reload(), 800);
            } else {
                showToast(data.error || 'Failed to upload', 'error');
            }
        } catch (e) {
            showToast('Upload network error', 'error');
        }
    } else {
        // Pending files for new property
        for (let i = 0; i < files.length; i++) {
            pendingUploadFiles.push(files[i]);
            renderLocalPreview(files[i]);
        }
        showToast(`${files.length} images queued for upload`);
    }
}

function renderLocalPreview(file) {
    const grid = document.getElementById('imagePreviewGrid');
    if (!grid) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const item = document.createElement('div');
        item.className = 'image-preview-item';
        item.innerHTML = `
            <img src="${e.target.result}" alt="Preview">
            <span class="cover-badge" style="background:#6b7280;">Queued</span>
        `;
        grid.appendChild(item);
    };
    reader.readAsDataURL(file);
}

async function setCoverImage(imageId) {
    const propertyId = document.getElementById('propertyId')?.value;
    if (!propertyId) return;

    try {
        const res = await fetch(`/api/properties/${propertyId}/images/${imageId}/cover`, {
            method: 'PATCH'
        });
        if (res.ok) {
            showToast('Cover photo updated');
            setTimeout(() => location.reload(), 600);
        } else {
            showToast('Failed to set cover', 'error');
        }
    } catch (e) {
        showToast('Network error', 'error');
    }
}

async function deleteImage(imageId) {
    const propertyId = document.getElementById('propertyId')?.value;
    if (!propertyId) return;

    if (!confirm('Remove this photo?')) return;

    try {
        const res = await fetch(`/api/properties/${propertyId}/images/${imageId}`, {
            method: 'DELETE'
        });
        if (res.ok) {
            showToast('Image deleted');
            const item = document.querySelector(`[data-image-id="${imageId}"]`);
            if (item) item.remove();
        } else {
            showToast('Failed to delete image', 'error');
        }
    } catch (e) {
        showToast('Network error', 'error');
    }
}

async function saveProperty(overrideStatus) {
    const form = document.getElementById('propertyForm');
    if (!form) return;

    const title = document.getElementById('title')?.value.trim();
    const category = document.getElementById('category')?.value;

    if (!title) {
        alert('Please enter a Property Title');
        document.getElementById('title')?.focus();
        return;
    }
    if (!category) {
        alert('Please select a Category');
        document.getElementById('category')?.focus();
        return;
    }

    const propertyId = document.getElementById('propertyId')?.value;
    const isEdit = Boolean(propertyId);

    // Collect amenities
    const amenityInputs = document.querySelectorAll('input[name="amenity"]:checked');
    const amenities = Array.from(amenityInputs).map(i => i.value);

    // Build payload
    const payload = {
        title,
        property_code: document.getElementById('property_code')?.value.trim() || undefined,
        category,
        purpose: document.getElementById('purpose')?.value || 'sale',
        short_description: document.getElementById('short_description')?.value.trim() || null,
        description: document.getElementById('description')?.value.trim() || null,
        price: document.getElementById('price')?.value ? parseFloat(document.getElementById('price').value) : null,
        price_negotiable: parseInt(document.getElementById('price_negotiable')?.value || '0'),
        availability: document.getElementById('availability')?.value || 'available',
        status: overrideStatus || document.getElementById('status')?.value || 'draft',
        is_featured: document.getElementById('is_featured')?.checked ? 1 : 0,

        // Location
        state: document.getElementById('state')?.value || 'Telangana',
        city: document.getElementById('city')?.value || 'Hyderabad',
        locality: document.getElementById('locality')?.value.trim() || null,
        full_address: document.getElementById('full_address')?.value.trim() || null,
        pin_code: document.getElementById('pin_code')?.value.trim() || null,
        map_link: document.getElementById('map_link')?.value.trim() || null,

        // Specs
        plot_area: document.getElementById('plot_area')?.value ? parseFloat(document.getElementById('plot_area').value) : null,
        built_up_area: document.getElementById('built_up_area')?.value ? parseFloat(document.getElementById('built_up_area').value) : null,
        carpet_area: document.getElementById('carpet_area')?.value ? parseFloat(document.getElementById('carpet_area').value) : null,
        area_unit: document.getElementById('area_unit')?.value || 'sq_ft',
        bedrooms: document.getElementById('bedrooms')?.value ? parseInt(document.getElementById('bedrooms').value) : null,
        bathrooms: document.getElementById('bathrooms')?.value ? parseInt(document.getElementById('bathrooms').value) : null,
        balconies: document.getElementById('balconies')?.value ? parseInt(document.getElementById('balconies').value) : null,
        floors: document.getElementById('floors')?.value ? parseInt(document.getElementById('floors').value) : null,
        facing: document.getElementById('facing')?.value || null,
        furnishing: document.getElementById('furnishing')?.value || null,
        parking: document.getElementById('parking')?.value.trim() || null,

        // Plot / Villa fields
        plot_dimensions: document.getElementById('plot_dimensions')?.value.trim() || null,
        road_width: document.getElementById('road_width')?.value.trim() || null,
        land_use_category: document.getElementById('land_use_category')?.value.trim() || null,
        approval_details: document.getElementById('approval_details')?.value.trim() || null,
        private_garden: document.getElementById('private_garden')?.checked ? 1 : 0,
        private_pool: document.getElementById('private_pool')?.checked ? 1 : 0,

        // Media
        virtual_tour_link: document.getElementById('virtual_tour_link')?.value.trim() || null,
        brochure_url: document.getElementById('brochure_url')?.value.trim() || null,
        amenities: JSON.stringify(amenities),

        // SEO & Admin
        seo_title: document.getElementById('seo_title')?.value.trim() || null,
        seo_description: document.getElementById('seo_description')?.value.trim() || null,
        admin_notes: document.getElementById('admin_notes')?.value.trim() || null
    };

    showToast('Saving property...');

    try {
        const url = isEdit ? `/api/properties/${propertyId}` : '/api/properties';
        const method = isEdit ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok) {
            const savedId = isEdit ? propertyId : data.property_id;

            // If there are pending files for newly created property, upload them now
            if (!isEdit && pendingUploadFiles.length > 0 && savedId) {
                showToast('Uploading images...');
                const formData = new FormData();
                for (let i = 0; i < pendingUploadFiles.length; i++) {
                    formData.append('images', pendingUploadFiles[i]);
                }
                await fetch(`/api/properties/${savedId}/images`, {
                    method: 'POST',
                    body: formData
                });
            }

            showToast('Property saved successfully');
            setTimeout(() => window.location = '/admin/properties', 900);
        } else {
            showToast(data.error || 'Failed to save property', 'error');
        }
    } catch (e) {
        showToast('Network error while saving', 'error');
    }
}
