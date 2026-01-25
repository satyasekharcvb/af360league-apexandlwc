import { LightningElement, api } from 'lwc';

export default class ComplianceCheckerCard extends LightningElement {
    @api value;
    
    // Getter to safely access properties
    get complianceData() {
        // Check if value is an object with expected properties
        if (this.value && typeof this.value === 'object') {
            return this.value;
        }
        
        // Return default structure if value is not as expected
        return {
            targetPrice: 0,
            observedPrice: 0,
            priceGap: 0,
            statusMessage: 'No Data',
            statusColor: 'GRAY',
            isSuccess: false,
            errorMessage: null,
            penalty: null,
            storeType: null
        };
    }

    // Computed properties for styling
    get bannerClass() {
        const baseClass = 'slds-notify slds-notify_alert slds-m-bottom_small';
        
        if (this.complianceData.statusColor === 'RED') {
            return `${baseClass} slds-theme_error`;
        } else if (this.complianceData.statusColor === 'YELLOW') {
            return `${baseClass} slds-theme_warning`;
        } else if (this.complianceData.statusColor === 'GREEN') {
            return `${baseClass} slds-theme_success`;
        } else {
            return `${baseClass} slds-theme_offline`;
        }
    }

    get statusIcon() {
        if (this.complianceData.statusColor === 'RED') {
            return 'utility:error';
        } else if (this.complianceData.statusColor === 'YELLOW') {
            return 'utility:warning';
        } else if (this.complianceData.statusColor === 'GREEN') {
            return 'utility:success';
        } else {
            return 'utility:info';
        }
    }

    get showDetails() {
        return this.complianceData.isSuccess && 
               this.complianceData.targetPrice != null && 
               this.complianceData.priceGap != null;
    }

    get hasError() {
        return !this.complianceData.isSuccess && this.complianceData.errorMessage;
    }

    get formattedObservedPrice() {
        return this.complianceData.observedPrice != null ? 
               `$${this.complianceData.observedPrice.toFixed(2)}` : '$0.00';
    }

    get formattedTargetPrice() {
        return this.complianceData.targetPrice != null ? 
               `$${this.complianceData.targetPrice.toFixed(2)}` : '$0.00';
    }

    get formattedPriceGap() {
        if (this.complianceData.priceGap == null) return '$0.00';
        const gap = this.complianceData.priceGap;
        const sign = gap >= 0 ? '+' : '';
        return `${sign}$${gap.toFixed(2)}`;
    }

    get showPenalty() {
        return this.complianceData.penalty != null && this.complianceData.penalty > 0;
    }

    get showStoreType() {
        return this.complianceData.storeType != null && 
               this.complianceData.storeType.trim().length > 0;
    }

    get formattedPenalty() {
        return this.complianceData.penalty != null ? 
               `$${this.complianceData.penalty.toFixed(2)}` : '$0.00';
    }
}