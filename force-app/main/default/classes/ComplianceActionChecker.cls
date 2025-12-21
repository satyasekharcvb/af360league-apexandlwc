/**
 * Field Rep Compliance Assistant (Agentforce)
 * 
 * Business Goal: Field Reps need to verify pricing compliance in real-time.
 * Compares Observed Price against Target Price from PromotionProduct records.
 */
global with sharing class ComplianceActionChecker {

/**
 * InvocableMethod: Check Price Compliance
 * Compares observed price against target price from PromotionProduct
 * 
 * @param requests List containing Store Name, Product Name, and Observed Price
 * @return List of ComplianceResult with target price, gap, and status
 */
@InvocableMethod(label='Check Price Compliance' description='Compares observed price against target price from PromotionProduct for the retail store today.')
global static List<ComplianceResult> checkPrice(List<ComplianceRequest> requests) {
    List<ComplianceResult> results = new List<ComplianceResult>();
    
    for (ComplianceRequest request : requests) {
        ComplianceResult result = new ComplianceResult();
        
        try {
            // 1. Data Logic: Query Target Price from PromotionProduct
            Decimal targetPrice = getTargetPrice(request.storeName, request.productName);
            
            // 2. Comparison: Calculate Gap = Observed - Target
            Decimal observedPrice = request.observedPrice;
            Decimal priceGap = observedPrice - targetPrice;

            // 3. Visual Logic: Determine Status based on Gap
            String statusMessage;
            String statusColor;
            if (priceGap > 0) {
                // Price too high - Consumer Overcharged
                statusMessage = 'Consumer Overcharged';
                statusColor = 'RED';
            } else if (priceGap < 0) {
                // Price too low - Margin Leakage
                statusMessage = 'Margin Leakage';
                statusColor = 'YELLOW';
            } else {
                // Price matches - Compliant
                statusMessage = 'Compliant';
                statusColor = 'GREEN';
            }

            // 4. Calculate Penalty using FormulaEval 
            Decimal penalty = null;
            String storeType = null;
            try {
                // Get store information
                StoreInfo storeInfo = getStoreInfo(request.storeName);
                storeType = storeInfo.storeType;
                
                // Only calculate penalty if there's a price gap and store type is available
                if (priceGap != 0 && storeType != null) {
                    // Query the penalty formula from Custom Metadata
                    SObject penaltyFormula = getPenaltyFormula(storeType);
                    
                    if (penaltyFormula != null) {
                        // Get daily volume
                        Decimal dailyVolume = getDailyVolume(storeInfo.storeId, request.productName);
                        
                        // Calculate penalty using FormulaEval
                        penalty = calculatePenaltyWithFormulaEval(
                            penaltyFormula,
                            observedPrice,
                            targetPrice,
                            dailyVolume
                        );
                    }
                }
            } catch (Exception penaltyException) {
                // Penalty calculation is optional, log but don't fail the main compliance check
                System.debug('Penalty calculation error: ' + penaltyException.getMessage());
                System.debug('Stack Trace: ' + penaltyException.getStackTraceString());
            }

            // Create ComplianceMetrics object with penalty and storeType
            String errorMsg = null;
            result.complianceMetrics = new ComplianceMetrics(
                targetPrice,
                observedPrice,
                priceGap,
                statusMessage,
                statusColor,
                true,
                errorMsg,
                penalty,
                storeType
            );
            
        } catch (Exception e) {
            // Handle errors gracefully
            Decimal nullDecimal = null;
            String nullString = null;
            String errorMsg = 'Error checking compliance: ' + e.getMessage();
            result.complianceMetrics = new ComplianceMetrics(
                nullDecimal,
                nullDecimal,
                nullDecimal,
                'Error',
                'GRAY',
                false,
                errorMsg,
                nullDecimal,
                nullString
            );
            System.debug('ComplianceCheckerAction Error: ' + e.getMessage());
            System.debug('Stack Trace: ' + e.getStackTraceString());
        }
        
        results.add(result);
    }
    
    return results;
}

/**
 * Retrieves Target_Shelf_Price__c for the specified Retail Store and Product today
 * 
 * Relationship path: Retail Store → Promotion Channel → Promotion → PromotionProduct
 * 
 * @param storeName Name of the retail store (e.g., "downtown store")
 * @param productName Name of the product
 * @return Target shelf price from PromotionProduct
 */
private static Decimal getTargetPrice(String storeName, String productName) {
    // Query PromotionProduct through the relationship chain:
    // Retail Store → Promotion Channel → Promotion → PromotionProduct
    Date today = Date.today();
    Datetime startOfDay = Datetime.newInstance(today.year(), today.month(), today.day());
    Datetime endOfDay = startOfDay.addDays(1);
    
    // First, get RetailStore
    List<RetailStore> stores = [
        SELECT Id
        FROM RetailStore
        WHERE Name = :storeName
        LIMIT 1
    ];
    
    if (stores.isEmpty()) {
        throw new ComplianceException('No RetailStore found with name: "' + storeName + '"');
    }
    
    RetailStore store = stores[0];
    
    // Get PromotionIds from PromotionChannels linked to the RetailStore
    Set<Id> promotionIds = new Set<Id>();
    List<PromotionChannel> channels = [
        SELECT PromotionId
        FROM PromotionChannel
        WHERE RetailStoreId = :store.Id
            AND PromotionId != null
    ];
    
    for (PromotionChannel channel : channels) {
        promotionIds.add(channel.PromotionId);
    }
    
    if (promotionIds.isEmpty()) {
        throw new ComplianceException('No PromotionChannel found for Store: "' + storeName + '"');
    }
    
    // Now query PromotionProduct filtered by PromotionId and Product
    List<PromotionProduct> promotionProducts = [
        SELECT Target_Shelf_Price__c
        FROM PromotionProduct
        WHERE PromotionId IN :promotionIds
            AND Product.Name = :productName
            AND CreatedDate >= :startOfDay
            AND CreatedDate < :endOfDay
            AND Target_Shelf_Price__c != null
        ORDER BY CreatedDate DESC
        LIMIT 1
    ];
    
    if (promotionProducts.size() > 0) {
        return promotionProducts[0].Target_Shelf_Price__c;
    }
    
    // If no record found for today, try to get the most recent one (fallback)
    List<PromotionProduct> recentProducts = [
        SELECT Target_Shelf_Price__c
        FROM PromotionProduct
        WHERE PromotionId IN :promotionIds
            AND Product.Name = :productName
            AND Target_Shelf_Price__c != null
        ORDER BY CreatedDate DESC
        LIMIT 1
    ];
    
    if (recentProducts.size() > 0) {
        return recentProducts[0].Target_Shelf_Price__c;
    }
    
    // If still no record found, throw exception
    throw new ComplianceException('No PromotionProduct record found for Store: "' + storeName + 
                                    '" and Product: "' + productName + '"');
}

/**
 * Step 1: Query Compliance Penalty Formula from Custom Metadata Type
 * 
 * @param storeType Store type (Flagship, Regular, Van)
 * @return CompliancePenaltyFormula__mdt record, or null if not found
 */
private static SObject getPenaltyFormula(String storeType) {
    if (String.isBlank(storeType)) {
        return null;
    }
    
    try {
        // Use dynamic SOQL to query Custom Metadata Type
        String query = 'SELECT Id, DeveloperName, MasterLabel, Store_Type__c, Formula__c ' +
                        'FROM Compliance_Penalty_Formula__mdt ' +
                        'WHERE Store_Type__c = :storeType ' +
                        'LIMIT 1';
        List<SObject> formulas = Database.query(query);
        
        if (formulas.isEmpty()) {
            System.debug('No CompliancePenaltyFormula found for store type: ' + storeType);
            return null;
        }
        
        return formulas[0];
    } catch (Exception e) {
        System.debug('Error querying CompliancePenaltyFormula: ' + e.getMessage());
        System.debug('Stack Trace: ' + e.getStackTraceString());
        return null;
    }
}

/**
 * Step 2: Get Store Information including Store Type
 * 
 * @param storeName Name of the retail store
 * @return StoreInfo containing storeId and storeType
 */
private class StoreInfo {
    Id storeId;
    String storeType;
}

private static StoreInfo getStoreInfo(String storeName) {
    StoreInfo info = new StoreInfo();
    
    // Query RetailStore to get store type
    List<RetailStore> stores = [
        SELECT Id, StoreType
        FROM RetailStore
        WHERE Name = :storeName
        LIMIT 1
    ];
    
    if (stores.isEmpty()) {
        throw new ComplianceException('No RetailStore found with name: "' + storeName + '"');
    }
    
    RetailStore store = stores[0];
    info.storeId = store.Id;
    info.storeType = store.StoreType;
    
    return info;
}

/**
 * Step 3: Get Daily Volume for penalty calculation
 * Hardcoded value - can be updated as needed
 * 
 * @param storeId Retail Store ID (not used, kept for method signature compatibility)
 * @param productName Product name (not used, kept for method signature compatibility)
 * @return Hardcoded daily volume value
 */
private static Decimal getDailyVolume(Id storeId, String productName) {
    // Hardcoded daily volume value
    return 100;
}

/**
 * Step 4: Calculate Penalty using FormulaEval namespace
 * 
 * @param formulaRecord CompliancePenaltyFormula__mdt record with the formula
 * @param observedPrice Observed price
 * @param targetPrice Target price
 * @param dailyVolume Daily volume
 * @return Calculated penalty amount, or 0 if calculation fails
 */
private static Decimal calculatePenaltyWithFormulaEval(SObject formulaRecord, Decimal observedPrice, Decimal targetPrice, Decimal dailyVolume) {
    if (formulaRecord == null) {
        return 0;
    }
    
    try {
        // Get the formula from the Custom Metadata record
        String formulaText = (String)formulaRecord.get('Formula__c');
        
        if (String.isBlank(formulaText)) {
            System.debug('Formula__c is blank in CompliancePenaltyFormula record');
            return 0;
        }
        
        PenaltyContextWrapper contextWrapper = new PenaltyContextWrapper(
            observedPrice, 
            targetPrice, 
            dailyVolume
        );
        
        Object result;

        // TODO FOR THE CHALLENGE: Implement Formula Eval with ComplianceActionChecker.PenaltyContextWrapper.class type. 
        // You can copy the Formula Eval expression from the video: https://youtu.be/kCo3L27FjP0?si=YLerl6HNZ-moWN5U&t=5028  
        
FormulaEval.FormulaInstance ff = Formula.builder()
.withType(ComplianceActionChecker.PenaltyContextWrapper.class)
.withReturnType(FormulaEval.FormulaReturnType.DECIMAL)
.withFormula(formulaText)
.build();

// --- Step 3: Evaluate against the wrapper instance ---
result = ff.evaluate(contextWrapper);

        Decimal penalty = 0;
        if (result instanceof Decimal) {
            penalty = (Decimal)result;
        } else if (result instanceof Double) {
            penalty = Decimal.valueOf((Double)result);
        } else if (result instanceof Integer) {
            penalty = Decimal.valueOf((Integer)result);
        } else if (result instanceof String) {
            try {
                penalty = Decimal.valueOf((String)result);
            } catch (Exception e) {
                System.debug('Error converting formula result to Decimal: ' + e.getMessage());
                return 0;
            }
        } else {
            System.debug('Unexpected formula result type: ' + result);
            return 0;
        }
        
        // Ensure penalty is positive (use absolute value)
        return Math.abs(penalty);
        
    } catch (Exception e) {
        System.debug('Error calculating penalty with FormulaEval: ' + e.getMessage());
        System.debug('Stack Trace: ' + e.getStackTraceString());
        return 0;
    }
}

/**
 * Input Variables for the InvocableMethod
 * Maps to User Query: "I am at the downtown store. The price is $2.00. Is that correct?"
 */
global class ComplianceRequest {
    @InvocableVariable(required=true label='Store Name' description='Name of the retail store (e.g., "downtown store")')
    global String storeName;
    
    @InvocableVariable(required=true label='Product Name' description='Name of the product')
    global String productName;
    
    @InvocableVariable(required=true label='Observed Price' description='The price observed by the field rep (e.g., 2.00)')
    global Decimal observedPrice;
}

/**
 * Output Variables for the InvocableMethod
 * Used by the Custom LWC (complianceCheckerCard) to render the UI
 */
@JsonAccess(serializable='always' deserializable='always')
global class ComplianceResult {
    @InvocableVariable(label='Compliance Metrics' description='Compliance metrics including target price, gap, status, and color')
    global ComplianceMetrics complianceMetrics;
}

global class PenaltyContextWrapper{
    // These names must exactly match the field API names used in your 'formulaText'
    global Decimal observed { get; set; }
    global Decimal target { get; set; }
    global Decimal dailyVolume { get; set; }
    global Decimal priceGap { get; set; }
    
    global PenaltyContextWrapper(Decimal observed, Decimal target, Decimal volume) {
        this.observed = observed;
        this.target = target;
        this.dailyVolume = volume;
        this.priceGap = observed - target;
    }
}

}