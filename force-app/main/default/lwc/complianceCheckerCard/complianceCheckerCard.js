import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class ComplianceCheckerCard extends LightningElement {
    // Public properties - can be set from parent component or flow
    @api value;


    // Computed properties for styling
    get bannerClass() {
        const baseClass = 'slds-notify slds-notify_alert slds-m-bottom_small';
        
        if (this.value.statusColor === 'RED') {
            return `${baseClass} slds-theme_error`;
        } else if (this.value.statusColor === 'YELLOW') {
            return `${baseClass} slds-theme_warning`;
        } else if (this.value.statusColor === 'GREEN') {
            return `${baseClass} slds-theme_success`;
        } else {
            return `${baseClass} slds-theme_offline`;
        }
    }

    get statusIcon() {
        if (this.value.statusColor === 'RED') {
            return 'utility:error';
        } else if (this.value.statusColor === 'YELLOW') {
            return 'utility:warning';
        } else if (this.value.statusColor === 'GREEN') {
            return 'utility:success';
        } else {
            return 'utility:info';
        }
    }

    get showDetails() {
        return this.value.isSuccess && this.value.targetPrice != null && this.value.priceGap != null;
    }

    

    get hasError() {
        return !this.value.isSuccess && this.value.errorMessage;
    }

    get formattedObservedPrice() {
        return this.value?.observedPrice != null ? this.value.observedPrice.toFixed(2) : '0.00';
    }

    get formattedTargetPrice() {
        return this.value.targetPrice != null ? this.value.targetPrice.toFixed(2) : '0.00';
    }

    get formattedPriceGap() {
        if (this.value.priceGap == null) return '$0.00';
        const gap = this.value.priceGap;
        const sign = gap >= 0 ? '+' : '';
        return `${sign}$${gap.toFixed(2)}`;
    }


    get showPenalty() {
        return this.value.penalty != null && this.value.penalty > 0;
    }

    get showStoreType() {
        return this.value.storeType != null && this.value.storeType.trim().length > 0;
    }

    get formattedPenalty() {
        return this.value.penalty != null ? this.value.penalty.toFixed(2) : '0.00';
    }

    /**
     * Shows a toast notification
     */
    showToast(title, message, variant) {
        const evt = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant,
            mode: 'dismissable'
        });
        this.dispatchEvent(evt);
    }
}