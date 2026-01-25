require 'xcodeproj'

project_path = 'ios/ReceiptScanner.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# Correct physical path is ios/ReceiptScanner/ReceiptParserModule.swift
# Relative to project (ios/), it is ReceiptScanner/ReceiptParserModule.swift

target = project.targets.find { |t| t.name == 'ReceiptScanner' }
group = project.main_group.find_subpath('ReceiptScanner', true)

# Find the existing references (which are likely broken)
file_ref_swift = group.files.find { |f| f.path == 'ReceiptParserModule.swift' }
file_ref_objc = group.files.find { |f| f.path == 'ReceiptParserModule.m' }

if file_ref_swift
  puts "Updating Swift file path..."
  file_ref_swift.path = 'ReceiptScanner/ReceiptParserModule.swift'
  # If the file reference was added to the group without a path, it assumes it's in the group's path.
  # If the group doesn't have a path set, it assumes project root.
  # Let's be explicit and set the path relative to the project source root.
  file_ref_swift.source_tree = '<group>' 
  # Actually, if we set path to ReceiptScanner/..., we should make sure where it's resolving from.
  # Let's try removing and re-adding explicitly with the correct path relative to the group if the group has a path.
  
  # Check group path
  puts "Group path: #{group.path}"
  
  if group.path == 'ReceiptScanner'
     # Then 'ReceiptParserModule.swift' should be correct if it's inside that dir.
     # But the error says it can't find it at .../ios/ReceiptParserModule.swift
     # This implies the group path might NOT be set, or set incorrectly.
     puts "Group path is set to ReceiptScanner. Strange."
  else
     puts "Group path is nil or empty. Setting explicit path."
     file_ref_swift.set_path('ReceiptScanner/ReceiptParserModule.swift')
  end
end

if file_ref_objc
  puts "Updating ObjC file path..."
  file_ref_objc.set_path('ReceiptScanner/ReceiptParserModule.m')
end

# To be safe, let's just remove and re-add them if we can't easily fix.
# But let's try simply setting the path first.
# Using 'set_path' is safer.

# Wait, if I added them with `group.new_reference('ReceiptParserModule.swift')` and group has no path, it defaults to project root (ios/).
# So I need to change it to 'ReceiptScanner/ReceiptParserModule.swift'.

if file_ref_swift
    file_ref_swift.set_path('ReceiptScanner/ReceiptParserModule.swift')
    puts "Fixed Swift path."
end

if file_ref_objc
    file_ref_objc.set_path('ReceiptScanner/ReceiptParserModule.m')
    puts "Fixed ObjC path."
end

project.save
puts "Project saved with path fixes."
