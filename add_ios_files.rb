require 'xcodeproj'

project_path = 'ios/ReceiptScanner.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# Find the group 'ReceiptScanner' (usually main group -> ReceiptScanner)
# Using find_subpath to be safe, assuming structure matches filesystem
group = project.main_group.find_subpath('ReceiptScanner', true)

# Define files to add relative to the project root (or group path)
# Since the script is running from root, and project is in ios/, 
# we need to be careful about paths.
# Xcodeproj usually works with paths relative to the .xcodeproj file or absolute.
# Let's use paths relative to the group's real path if possible, or usually just add the file reference.

# The files are physically at ios/ReceiptScanner/ReceiptParserModule.swift
# The .xcodeproj is at ios/ReceiptScanner.xcodeproj
# So relative to .xcodeproj, the files are at ReceiptScanner/ReceiptParserModule.swift

file_ref_swift = group.new_reference('ReceiptParserModule.swift')
file_ref_objc = group.new_reference('ReceiptParserModule.m')

# Find the main target. usually the first one or named 'ReceiptScanner'
target = project.targets.find { |t| t.name == 'ReceiptScanner' }

if target
  puts "Found target: #{target.name}"
  
  # Add to Compile Sources (Build Phase)
  target.add_file_references([file_ref_swift, file_ref_objc])
  
  puts "Added ReceiptParserModule.swift and .m to target."
  project.save
  puts "Project saved."
else
  puts "Error: Could not find target 'ReceiptScanner'"
  exit 1
end
