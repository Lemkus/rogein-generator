# test_syntax.ps1
Write-Host "Testing PowerShell syntax..." -ForegroundColor Green

# Test basic syntax
$testVar = "test"
Write-Host "Variable: $testVar" -ForegroundColor Yellow

# Test array syntax
$testArray = @("item1", "item2", "item3")
Write-Host "Array length: $($testArray.Length)" -ForegroundColor Yellow

# Test here-string syntax
$hereString = @"
This is a test
Multi-line string
"@
Write-Host "Here-string: $hereString" -ForegroundColor Yellow

Write-Host "✅ All syntax tests passed!" -ForegroundColor Green
